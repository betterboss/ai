import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/estimate/[id] - Get a single estimate with line items and takeoffs
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const sql = getSQL();

    const [estimates, items, takeoffs] = await Promise.all([
      sql`SELECT * FROM estimates WHERE id = ${id}`,
      sql`SELECT * FROM estimate_items WHERE estimate_id = ${id} ORDER BY sort_order`,
      sql`SELECT * FROM takeoffs WHERE estimate_id = ${id} ORDER BY created_at`,
    ]);

    if (estimates.length === 0) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }

    return Response.json({
      estimate: estimates[0],
      items,
      takeoffs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/estimate/[id] - Update estimate details
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const sql = getSQL();

    // Build dynamic SET clause from allowed fields
    const allowed = ['name', 'client_name', 'client_email', 'client_phone', 'job_address', 'notes', 'status', 'jobtread_job_id', 'jobtread_estimate_id'];
    const sets = [];
    const vals = [];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        sets.push(key);
        vals.push(body[key]);
      }
    }

    if (sets.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Use parameterized query for each field
    // Neon's sql tag doesn't support dynamic column names, so we update field by field
    for (let i = 0; i < sets.length; i++) {
      const field = sets[i];
      const value = vals[i];
      // Use raw SQL for dynamic column name (safe because we validate against allowed list)
      await sql`UPDATE estimates SET updated_at = now() WHERE id = ${id}`;
      await sql(`UPDATE estimates SET ${field} = $1, updated_at = now() WHERE id = $2`, [value, id]);
    }

    const rows = await sql`SELECT * FROM estimates WHERE id = ${id}`;
    return Response.json({ estimate: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/estimate/[id] - Delete an estimate (line items cascade)
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const sql = getSQL();

    await sql`DELETE FROM estimates WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
