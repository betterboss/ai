import {
  searchJobs,
  createJob,
  addJobComment,
  updateJob,
  getJobDetails,
} from '../../../lib/jobtread';
import { getSQL } from '../../../lib/db';

export const runtime = 'nodejs';

// POST /api/voice/execute - Execute a parsed voice command against JobTread
export async function POST(request) {
  try {
    const { intent, params, grantKey, apiKey } = await request.json();

    if (!intent) {
      return Response.json({ error: 'Intent is required' }, { status: 400 });
    }
    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const sql = getSQL();
    let result;
    let message;

    switch (intent) {
      case 'clock_in': {
        // Find the job first if only name given
        let jobId = params.jobId;
        if (!jobId && params.jobName) {
          const jobs = await searchJobs(grantKey, params.jobName);
          if (jobs.length === 0) {
            return Response.json({
              success: false,
              message: `No job found matching "${params.jobName}"`,
            });
          }
          jobId = jobs[0].id;
        }
        if (!jobId) {
          return Response.json({
            success: false,
            message: 'Please specify a job name to clock into.',
          });
        }

        // Add a clock-in comment to the job
        const clockInTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        result = await addJobComment(grantKey, {
          jobId,
          text: `[CLOCK IN] Clocked in at ${clockInTime} via voice command`,
        });

        // Log to DB
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS time_entries (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              job_id TEXT NOT NULL,
              type TEXT NOT NULL,
              timestamp TIMESTAMPTZ DEFAULT now(),
              source TEXT DEFAULT 'voice',
              created_at TIMESTAMPTZ DEFAULT now()
            )
          `;
          await sql`INSERT INTO time_entries (job_id, type, source) VALUES (${jobId}, 'clock_in', 'voice')`;
        } catch { /* table creation race condition is ok */ }

        message = `Clocked in at ${clockInTime}`;
        break;
      }

      case 'clock_out': {
        let jobId = params.jobId;
        if (!jobId && params.jobName) {
          const jobs = await searchJobs(grantKey, params.jobName);
          if (jobs.length > 0) jobId = jobs[0].id;
        }
        if (!jobId) {
          return Response.json({
            success: false,
            message: 'Please specify a job name to clock out of.',
          });
        }

        const clockOutTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        result = await addJobComment(grantKey, {
          jobId,
          text: `[CLOCK OUT] Clocked out at ${clockOutTime} via voice command`,
        });

        try {
          await sql`INSERT INTO time_entries (job_id, type, source) VALUES (${jobId}, 'clock_out', 'voice')`;
        } catch { /* ok */ }

        message = `Clocked out at ${clockOutTime}`;
        break;
      }

      case 'add_comment': {
        let jobId = params.jobId;
        if (!jobId && params.jobName) {
          const jobs = await searchJobs(grantKey, params.jobName);
          if (jobs.length === 0) {
            return Response.json({
              success: false,
              message: `No job found matching "${params.jobName}"`,
            });
          }
          jobId = jobs[0].id;
        }
        if (!jobId) {
          return Response.json({ success: false, message: 'Please specify a job.' });
        }
        if (!params.text) {
          return Response.json({ success: false, message: 'No comment text provided.' });
        }

        result = await addJobComment(grantKey, { jobId, text: params.text });
        message = 'Comment added successfully';
        break;
      }

      case 'create_daily_log': {
        let jobId = params.jobId;
        if (!jobId && params.jobName) {
          const jobs = await searchJobs(grantKey, params.jobName);
          if (jobs.length > 0) jobId = jobs[0].id;
        }

        // Save daily log to DB
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS daily_logs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              job_id TEXT,
              job_name TEXT,
              narrative TEXT,
              weather TEXT,
              crew_count INT,
              photos JSONB DEFAULT '[]',
              source TEXT DEFAULT 'voice',
              created_at TIMESTAMPTZ DEFAULT now()
            )
          `;
        } catch { /* ok */ }

        const logRows = await sql`
          INSERT INTO daily_logs (job_id, job_name, narrative, weather, crew_count, source)
          VALUES (${jobId || null}, ${params.jobName || null}, ${params.notes || ''}, ${params.weather || null}, ${params.crew_count || null}, 'voice')
          RETURNING *
        `;
        result = logRows[0];

        // Also add as comment on the job if we have a jobId
        if (jobId) {
          await addJobComment(grantKey, {
            jobId,
            text: `[DAILY LOG] ${params.notes || ''}${params.weather ? ' | Weather: ' + params.weather : ''}`,
          });
        }

        message = 'Daily log created';
        break;
      }

      case 'update_status': {
        let jobId = params.jobId;
        if (!jobId && params.jobName) {
          const jobs = await searchJobs(grantKey, params.jobName);
          if (jobs.length === 0) {
            return Response.json({
              success: false,
              message: `No job found matching "${params.jobName}"`,
            });
          }
          jobId = jobs[0].id;
        }
        if (!jobId) {
          return Response.json({ success: false, message: 'Please specify a job.' });
        }

        result = await updateJob(grantKey, { jobId, status: params.status });
        message = `Job status updated to "${params.status}"`;
        break;
      }

      case 'search_job': {
        if (!params.search) {
          return Response.json({ success: false, message: 'Please specify a search term.' });
        }
        result = await searchJobs(grantKey, params.search);
        message = `Found ${result.length} job(s)`;
        break;
      }

      case 'create_job': {
        if (!params.name) {
          return Response.json({ success: false, message: 'Please specify a job name.' });
        }
        result = await createJob(grantKey, {
          name: params.name,
          address: params.address || null,
        });
        message = `Job "${params.name}" created`;
        break;
      }

      default:
        return Response.json({
          success: false,
          message: `Unknown intent: ${intent}. Please try a different command.`,
        });
    }

    return Response.json({
      success: true,
      result,
      message,
    });
  } catch (error) {
    console.error('Voice execute error:', error);

    if (error.message?.includes('authentication')) {
      return Response.json({ error: 'JobTread authentication failed. Check your grant key.' }, { status: 401 });
    }

    return Response.json({ error: error.message || 'Failed to execute voice command' }, { status: 500 });
  }
}
