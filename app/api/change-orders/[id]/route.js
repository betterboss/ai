import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/change-orders/[id] - Get single change order
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sql = getSQL();

    const rows = await sql`
      SELECT co.*, e.name as estimate_name, e.client_name, e.jobtread_job_id
      FROM change_orders co
      LEFT JOIN estimates e ON co.estimate_id = e.id
      WHERE co.id = ${id}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Change order not found' }, { status: 404 });
    }

    return Response.json({ changeOrder: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/change-orders/[id] - Update change order
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const sql = getSQL();

    // Build dynamic update from provided fields
    const allowedFields = {
      description: 'description',
      reason: 'reason',
      originalScope: 'original_scope',
      newScope: 'new_scope',
      costImpact: 'cost_impact',
      priceImpact: 'price_impact',
      customerExplanation: 'customer_explanation',
      status: 'status',
      estimateId: 'estimate_id',
      jobtreadSynced: 'jobtread_synced',
    };

    // We'll use a full update approach, loading current then merging
    const existing = await sql`SELECT * FROM change_orders WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: 'Change order not found' }, { status: 404 });
    }

    const current = existing[0];

    const description = body.description !== undefined ? body.description : current.description;
    const reason = body.reason !== undefined ? body.reason : current.reason;
    const originalScope = body.originalScope !== undefined ? body.originalScope : current.original_scope;
    const newScope = body.newScope !== undefined ? body.newScope : current.new_scope;
    const costImpact = body.costImpact !== undefined ? body.costImpact : current.cost_impact;
    const priceImpact = body.priceImpact !== undefined ? body.priceImpact : current.price_impact;
    const customerExplanation = body.customerExplanation !== undefined ? body.customerExplanation : current.customer_explanation;
    const status = body.status !== undefined ? body.status : current.status;
    const estimateId = body.estimateId !== undefined ? body.estimateId : current.estimate_id;
    const jobtreadSynced = body.jobtreadSynced !== undefined ? body.jobtreadSynced : current.jobtread_synced;

    const rows = await sql`
      UPDATE change_orders SET
        description = ${description},
        reason = ${reason},
        original_scope = ${originalScope},
        new_scope = ${newScope},
        cost_impact = ${costImpact},
        price_impact = ${priceImpact},
        customer_explanation = ${customerExplanation},
        status = ${status},
        estimate_id = ${estimateId},
        jobtread_synced = ${jobtreadSynced}
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({ changeOrder: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/change-orders/[id] - Delete change order
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const sql = getSQL();

    const rows = await sql`
      DELETE FROM change_orders WHERE id = ${id} RETURNING id
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Change order not found' }, { status: 404 });
    }

    return Response.json({ success: true, deletedId: rows[0].id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
