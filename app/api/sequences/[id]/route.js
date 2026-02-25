import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/sequences/[id] - Get sequence with steps
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const sql = getSQL();

    const sequences = await sql`SELECT * FROM sequences WHERE id = ${id}`;
    if (!sequences[0]) return Response.json({ error: 'Sequence not found' }, { status: 404 });

    const steps = await sql`
      SELECT * FROM sequence_steps WHERE sequence_id = ${id} ORDER BY step_order ASC
    `;

    const enrollments = await sql`
      SELECT * FROM sequence_enrollments WHERE sequence_id = ${id} ORDER BY created_at DESC LIMIT 50
    `;

    return Response.json({ sequence: sequences[0], steps, enrollments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/sequences/[id] - Update sequence
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { name, triggerEvent, isActive, steps } = await request.json();
    const sql = getSQL();

    // Update sequence metadata
    const rows = await sql`
      UPDATE sequences SET
        name = COALESCE(${name}, name),
        trigger_event = COALESCE(${triggerEvent}, trigger_event),
        is_active = COALESCE(${isActive}, is_active)
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) return Response.json({ error: 'Sequence not found' }, { status: 404 });

    // If steps provided, replace all steps
    if (steps && Array.isArray(steps)) {
      await sql`DELETE FROM sequence_steps WHERE sequence_id = ${id}`;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await sql`
          INSERT INTO sequence_steps (sequence_id, step_order, delay_days, delay_hours, action_type, action_config, conditions)
          VALUES (${id}, ${i}, ${step.delay_days || 0}, ${step.delay_hours || 0},
                  ${step.action_type}, ${JSON.stringify(step.action_config || {})},
                  ${JSON.stringify(step.conditions || {})})
        `;
      }
    }

    return Response.json({ sequence: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/sequences/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const sql = getSQL();
    await sql`DELETE FROM sequences WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
