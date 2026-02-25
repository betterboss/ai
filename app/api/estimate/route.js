import { getSQL } from '../../lib/db';

export const runtime = 'edge';

// GET /api/estimate - List all estimates
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const sql = getSQL();

    let rows;
    if (status && userId) {
      rows = await sql`SELECT * FROM estimates WHERE status = ${status} AND user_id = ${userId} ORDER BY created_at DESC`;
    } else if (status) {
      rows = await sql`SELECT * FROM estimates WHERE status = ${status} ORDER BY created_at DESC`;
    } else if (userId) {
      rows = await sql`SELECT * FROM estimates WHERE user_id = ${userId} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM estimates ORDER BY created_at DESC`;
    }

    return Response.json({ estimates: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/estimate - Create a new estimate
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, client_name, client_email, client_phone, job_address, notes, user_id } = body;

    if (!name) {
      return Response.json({ error: 'Estimate name is required' }, { status: 400 });
    }

    const sql = getSQL();
    const rows = await sql`
      INSERT INTO estimates (name, client_name, client_email, client_phone, job_address, notes, user_id, status, total_cost, total_price, margin_pct)
      VALUES (${name}, ${client_name || null}, ${client_email || null}, ${client_phone || null}, ${job_address || null}, ${notes || null}, ${user_id || null}, 'draft', 0, 0, 0)
      RETURNING *
    `;

    return Response.json({ estimate: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
