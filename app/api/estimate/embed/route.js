import { indexEstimate } from '../../../lib/rag';
import { getSQL } from '../../../lib/db';

export const runtime = 'nodejs';

// POST /api/estimate/embed - Generate and store an embedding for an estimate
export async function POST(request) {
  try {
    const body = await request.json();
    const { estimateId, apiKey, userId: bodyUserId } = body;

    if (!estimateId) {
      return Response.json({ error: 'estimateId is required' }, { status: 400 });
    }

    // Resolve userId: prefer body param, then look up from the estimate itself
    let userId = bodyUserId;
    if (!userId) {
      const sql = getSQL();
      const rows = await sql`
        SELECT user_id FROM estimates WHERE id = ${estimateId}
      `;
      if (rows.length === 0) {
        return Response.json({ error: `Estimate ${estimateId} not found` }, { status: 404 });
      }
      userId = rows[0].user_id;
    }

    if (!userId) {
      return Response.json(
        { error: 'userId is required — provide it in the request body or ensure the estimate has a user_id' },
        { status: 400 }
      );
    }

    // Index the estimate (generates embedding and stores it)
    const metadata = await indexEstimate(userId, estimateId);

    return Response.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error('Embed error:', error);

    if (error.message?.includes('not found')) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error.message?.includes('OPENAI_API_KEY')) {
      return Response.json(
        { error: 'Server configuration error: missing OpenAI API key for embeddings' },
        { status: 503 }
      );
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}
