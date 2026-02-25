import { searchSimilarEstimates } from '../../../lib/rag';
import { getSQL } from '../../../lib/db';

export const runtime = 'nodejs';

// POST /api/estimate/similar - Find similar past estimates using RAG
export async function POST(request) {
  try {
    const body = await request.json();
    const { query, limit, apiKey, userId: bodyUserId } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Response.json({ error: 'query text is required' }, { status: 400 });
    }

    // Resolve userId: prefer body param, then try to look up from apiKey
    let userId = bodyUserId;
    if (!userId && apiKey) {
      try {
        const sql = getSQL();
        const rows = await sql`
          SELECT id FROM users WHERE anthropic_api_key = ${apiKey}
        `;
        if (rows.length > 0) {
          userId = rows[0].id;
        }
      } catch {
        // Non-fatal: user just needs to provide userId explicitly
      }
    }

    if (!userId) {
      return Response.json(
        { error: 'userId is required — provide it in the request body or ensure your API key is registered' },
        { status: 400 }
      );
    }

    const searchLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);

    const results = await searchSimilarEstimates(userId, query.trim(), searchLimit);

    return Response.json({
      results: results.map(r => ({
        estimateId: r.estimateId,
        name: r.estimateName,
        clientName: r.clientName,
        jobAddress: r.jobAddress,
        status: r.status,
        totalCost: r.totalCost,
        totalPrice: r.totalPrice,
        marginPct: r.marginPct,
        similarity: r.similarity,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Similar search error:', error);

    if (error.message?.includes('OPENAI_API_KEY')) {
      return Response.json(
        { error: 'Server configuration error: missing OpenAI API key for embeddings' },
        { status: 503 }
      );
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
}
