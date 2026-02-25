import { getSQL } from '../../lib/db';

export const runtime = 'edge';

// GET /api/change-orders - List change orders
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sql = getSQL();

    let rows;
    if (userId) {
      rows = await sql`
        SELECT co.*, e.name as estimate_name, e.client_name
        FROM change_orders co
        LEFT JOIN estimates e ON co.estimate_id = e.id
        WHERE co.user_id = ${userId}
        ORDER BY co.created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT co.*, e.name as estimate_name, e.client_name
        FROM change_orders co
        LEFT JOIN estimates e ON co.estimate_id = e.id
        ORDER BY co.created_at DESC
      `;
    }

    return Response.json({ changeOrders: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/change-orders - Create a new change order
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      userId,
      estimateId,
      description,
      reason,
      originalScope,
      newScope,
      costImpact,
      priceImpact,
      customerExplanation,
    } = body;

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!description) {
      return Response.json({ error: 'Description is required' }, { status: 400 });
    }

    const sql = getSQL();

    const rows = await sql`
      INSERT INTO change_orders (
        user_id, estimate_id, description, reason,
        original_scope, new_scope,
        cost_impact, price_impact,
        customer_explanation, status, jobtread_synced
      )
      VALUES (
        ${userId},
        ${estimateId || null},
        ${description},
        ${reason || null},
        ${originalScope || null},
        ${newScope || null},
        ${costImpact || 0},
        ${priceImpact || 0},
        ${customerExplanation || null},
        'draft',
        false
      )
      RETURNING *
    `;

    return Response.json({ changeOrder: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
