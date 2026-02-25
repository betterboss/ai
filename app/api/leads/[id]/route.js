import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/leads/[id] - Get a single lead
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sql = getSQL();

    const rows = await sql`SELECT * FROM leads WHERE id = ${id}`;

    if (rows.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    return Response.json({ lead: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/leads/[id] - Update a lead
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sql = getSQL();

    // Check lead exists
    const existing = await sql`SELECT * FROM leads WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const {
      name,
      email,
      phone,
      address,
      source,
      job_description,
      status,
      jobtread_contact_id,
      jobtread_job_id,
      notes,
    } = body;

    // Merge: only update fields that were provided
    const updated = {
      name: name !== undefined ? name : existing[0].name,
      email: email !== undefined ? email : existing[0].email,
      phone: phone !== undefined ? phone : existing[0].phone,
      address: address !== undefined ? address : existing[0].address,
      source: source !== undefined ? source : existing[0].source,
      job_description: job_description !== undefined ? job_description : existing[0].job_description,
      status: status !== undefined ? status : existing[0].status,
      jobtread_contact_id: jobtread_contact_id !== undefined ? jobtread_contact_id : existing[0].jobtread_contact_id,
      jobtread_job_id: jobtread_job_id !== undefined ? jobtread_job_id : existing[0].jobtread_job_id,
      notes: notes !== undefined ? notes : existing[0].notes,
    };

    const rows = await sql`
      UPDATE leads SET
        name = ${updated.name},
        email = ${updated.email},
        phone = ${updated.phone},
        address = ${updated.address},
        source = ${updated.source},
        job_description = ${updated.job_description},
        status = ${updated.status},
        jobtread_contact_id = ${updated.jobtread_contact_id},
        jobtread_job_id = ${updated.jobtread_job_id},
        notes = ${updated.notes},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({ lead: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/leads/[id] - Delete a lead
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sql = getSQL();

    const rows = await sql`DELETE FROM leads WHERE id = ${id} RETURNING id`;

    if (rows.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    return Response.json({ success: true, id: rows[0].id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
