import { getSQL } from '../../lib/db';

export const runtime = 'edge';

// GET /api/leads - List leads for authenticated user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const userId = searchParams.get('userId') || request.headers.get('x-user-id');

    const sql = getSQL();

    // Build query based on filters
    let rows;
    if (status && source && userId) {
      rows = await sql`
        SELECT * FROM leads
        WHERE status = ${status} AND source = ${source} AND user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (status && source) {
      rows = await sql`
        SELECT * FROM leads
        WHERE status = ${status} AND source = ${source}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (status && userId) {
      rows = await sql`
        SELECT * FROM leads
        WHERE status = ${status} AND user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (source && userId) {
      rows = await sql`
        SELECT * FROM leads
        WHERE source = ${source} AND user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (status) {
      rows = await sql`
        SELECT * FROM leads
        WHERE status = ${status}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (source) {
      rows = await sql`
        SELECT * FROM leads
        WHERE source = ${source}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (userId) {
      rows = await sql`
        SELECT * FROM leads
        WHERE user_id = ${userId}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM leads
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    }

    return Response.json({ leads: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/leads - Create a new lead
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      source,
      job_description,
      status,
      user_id,
      api_key,
      jobtread_contact_id,
      jobtread_job_id,
    } = body;

    if (!name) {
      return Response.json({ error: 'Lead name is required' }, { status: 400 });
    }

    const resolvedUserId = user_id || request.headers.get('x-user-id') || null;

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
        ${source || 'manual'},
        ${job_description || null},
        ${status || 'new'},
        ${resolvedUserId},
        ${jobtread_contact_id || null},
        ${jobtread_job_id || null}
      )
      RETURNING *
    `;

    return Response.json({ lead: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
