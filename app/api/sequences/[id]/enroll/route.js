import { getSQL } from '../../../../lib/db';
import { enrollInSequence } from '../../../../lib/sequences';

export const runtime = 'edge';

// POST /api/sequences/[id]/enroll - Enroll a contact into a sequence
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { userId, contactName, contactEmail, contactPhone, leadId, jobId } = await request.json();

    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });
    if (!contactEmail && !contactPhone) {
      return Response.json({ error: 'Either contactEmail or contactPhone required' }, { status: 400 });
    }

    const sql = getSQL();

    // Verify sequence exists and belongs to user
    const sequences = await sql`
      SELECT id FROM sequences WHERE id = ${id} AND user_id = ${userId}
    `;
    if (!sequences[0]) return Response.json({ error: 'Sequence not found' }, { status: 404 });

    const result = await enrollInSequence(sql, {
      sequenceId: id,
      userId,
      contactName,
      contactEmail,
      contactPhone,
      leadId,
      jobId,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 409 });
    }

    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
