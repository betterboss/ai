import { getSQL } from '../../lib/db';

export const runtime = 'edge';

// GET /api/sequences - List sequences for a user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

    const sql = getSQL();
    const sequences = await sql`
      SELECT s.*,
        (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as step_count,
        (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrollments
      FROM sequences s
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
    `;

    return Response.json({ sequences });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/sequences - Create a new sequence
export async function POST(request) {
  try {
    const { userId, name, triggerEvent } = await request.json();
    if (!userId || !name) return Response.json({ error: 'userId and name required' }, { status: 400 });

    const sql = getSQL();
    const rows = await sql`
      INSERT INTO sequences (user_id, name, trigger_event)
      VALUES (${userId}, ${name}, ${triggerEvent || null})
      RETURNING *
    `;

    return Response.json({ sequence: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
