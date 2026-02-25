import { getSQL } from '../../../lib/db';
import { createContact, createJob } from '../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/leads/capture - Receive lead from Chrome extension and auto-create in JobTread
export async function POST(request) {
  try {
    const body = await request.json();
    const { source, name, email, phone, address, jobDescription, grantKey } = body;

    if (!name) {
      return Response.json({ error: 'Lead name is required' }, { status: 400 });
    }

    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const userId = request.headers.get('x-user-id') || null;

    // Step 1: Create contact in JobTread
    let jobtreadContact;
    try {
      jobtreadContact = await createContact(grantKey, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        accountType: 'customer',
      });
    } catch (err) {
      return Response.json(
        { error: 'Failed to create JobTread contact: ' + err.message },
        { status: 502 }
      );
    }

    // Step 2: Create job in JobTread linked to the contact
    let jobtreadJob;
    try {
      const jobName = jobDescription
        ? name + ' - ' + jobDescription.slice(0, 80)
        : name + ' - Lead from ' + (source || 'web');

      jobtreadJob = await createJob(grantKey, {
        name: jobName,
        address: address || undefined,
        contactId: jobtreadContact.id,
      });
    } catch (err) {
      return Response.json(
        { error: 'Contact created but failed to create JobTread job: ' + err.message, jobtreadContact },
        { status: 502 }
      );
    }

    // Step 3: Save lead to database with JobTread IDs
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO leads (
        name, email, phone, address, source, job_description,
        status, user_id, jobtread_contact_id, jobtread_job_id
      )
      VALUES (
        ${name},
        ${email || null},
        ${phone || null},
        ${address || null},
        ${source || 'extension'},
        ${jobDescription || null},
        ${'converted'},
        ${userId},
        ${jobtreadContact.id || null},
        ${jobtreadJob.id || null}
      )
      RETURNING *
    `;

    // Step 4: Return the complete result
    return Response.json({
      lead: rows[0],
      jobtreadContact,
      jobtreadJob,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
