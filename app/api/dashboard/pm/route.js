export const runtime = 'nodejs';

import { getOrgId, paveQuery, getOrganizationJobs } from '../../../lib/jobtread';

// GET /api/dashboard/pm - Project Manager dashboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grantKey = searchParams.get('grantKey');

    if (!grantKey) {
      return Response.json({ error: 'grantKey is required' }, { status: 400 });
    }

    const org = await getOrgId(grantKey);

    // Fetch jobs and tasks in parallel
    const [allJobs, tasks] = await Promise.all([
      getOrganizationJobs(grantKey, { size: 100 }),
      getOrgTasks(grantKey, org.id),
    ]);

    // Active projects (not closed)
    const activeProjects = allJobs
      .filter(j => !j.closedOn && j.status !== 'closed')
      .map(j => ({
        id: j.id,
        name: j.name,
        number: j.number,
        status: j.status,
        stage: j.pipelineStage?.name || 'Unknown',
      }));

    // Task completion stats
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.completedAt);
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.completedAt) return false;
      if (!t.dueAt) return false;
      return new Date(t.dueAt) < new Date();
    });

    const taskCompletion = tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 1000) / 10
      : 0;

    // Daily log compliance - estimate based on active projects with recent comments
    const projectsWithActivity = await countProjectsWithRecentActivity(grantKey, activeProjects.slice(0, 20));
    const dailyLogCompliance = activeProjects.length > 0
      ? Math.round((projectsWithActivity / activeProjects.length) * 1000) / 10
      : 0;

    // Overdue items list
    const overdueItems = overdueTasks.slice(0, 15).map(t => ({
      id: t.id,
      name: t.name,
      dueAt: t.dueAt,
      assignee: t.assignee?.name || null,
    }));

    // Projects by stage
    const stageBreakdown = {};
    for (const p of activeProjects) {
      const stage = p.stage || 'Unassigned';
      if (!stageBreakdown[stage]) stageBreakdown[stage] = 0;
      stageBreakdown[stage]++;
    }

    return Response.json({
      dailyLogCompliance,
      overdueItems,
      overdueCount: overdueTasks.length,
      taskCompletion,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      activeProjects: activeProjects.length,
      projectsList: activeProjects.slice(0, 20),
      stageBreakdown: Object.entries(stageBreakdown).map(([name, count]) => ({ name, count })),
    });
  } catch (error) {
    console.error('PM dashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Get tasks for the organization
async function getOrgTasks(grantKey, orgId) {
  try {
    const data = await paveQuery(grantKey, {
      tasks: {
        $: {
          organizationId: orgId,
          size: 200,
          sortBy: [{ field: 'dueAt', direction: 'ASC' }],
        },
        nodes: {
          id: {},
          name: {},
          status: {},
          dueAt: {},
          completedAt: {},
          assignee: {
            name: {},
          },
        },
      },
    });
    return data.tasks?.nodes || [];
  } catch (e) {
    // Tasks endpoint might not be available in all JobTread versions
    console.warn('Could not fetch tasks:', e.message);
    return [];
  }
}

// Helper: Count projects with recent activity (comments in last 24h)
async function countProjectsWithRecentActivity(grantKey, projects) {
  let count = 0;
  // Sample up to 10 projects to avoid rate limits
  const sample = projects.slice(0, 10);
  for (const proj of sample) {
    try {
      const data = await paveQuery(grantKey, {
        job: {
          $: { id: proj.id },
          comments: {
            $: { size: 1, sortBy: [{ field: 'createdAt', direction: 'DESC' }] },
            nodes: {
              createdAt: {},
            },
          },
        },
      });
      const lastComment = data.job?.comments?.nodes?.[0];
      if (lastComment?.createdAt) {
        const commentDate = new Date(lastComment.createdAt);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (commentDate > oneDayAgo) count++;
      }
    } catch (e) {
      // Skip if comments query fails
    }
  }
  // Extrapolate from sample
  if (sample.length > 0 && sample.length < projects.length) {
    count = Math.round((count / sample.length) * projects.length);
  }
  return count;
}
