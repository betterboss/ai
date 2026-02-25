import { getSQL } from '../../../../lib/db';
import { createContact, createJob } from '../../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/leads/[id]/convert - Convert an existing lead to a JobTread job
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { grantKey } = body;

    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Fetch the lead
    const existing = await sql`SELECT * FROM leads WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = existing[0];

    // Check if already converted
    if (lead.jobtread_job_id) {
      return Response.json(
        { error: 'Lead already converted to JobTread job', jobtread_job_id: lead.jobtread_job_id },
        { status: 409 }
      );
    }

    // Step 1: Create contact in JobTread (or use existing if we have one)
    let contactId = lead.jobtread_contact_id;
    let jobtreadContact = null;

    if (!contactId) {
      try {
        jobtreadContact = await createContact(grantKey, {
          name: lead.name,
          email: lead.email || undefined,
          phone: lead.phone || undefined,
          accountType: 'customer',
        });
        contactId = jobtreadContact.id;
      } catch (err) {
        return Response.json(
          { error: 'Failed to create JobTread contact: ' + err.message },
          { status: 502 }
        );
      }
    }

    // Step 2: Create job in JobTread
    let jobtreadJob;
    try {
      const jobName = lead.job_description
        ? lead.name + ' - ' + lead.job_description.slice(0, 80)
        : lead.name + ' - Lead from ' + (lead.source || 'web');

      jobtreadJob = await createJob(grantKey, {
        name: jobName,
        address: lead.address || undefined,
        contactId,
      });
    } catch (err) {
      return Response.json(
        { error: 'Failed to create JobTread job: ' + err.message },
        { status: 502 }
      );
    }

    // Step 3: Update lead in database
    const rows = await sql`
      UPDATE leads SET
        status = 'converted',
        jobtread_contact_id = ${contactId},
        jobtread_job_id = ${jobtreadJob.id},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({
      lead: rows[0],
      jobtreadContact: jobtreadContact || { id: contactId },
      jobtreadJob,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
