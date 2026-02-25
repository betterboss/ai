import { getSQL } from '../../../../lib/db';
import { addJobComment } from '../../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/change-orders/[id]/sync - Sync change order to JobTread
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { grantKey } = await request.json();

    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load the change order with its linked estimate
    const rows = await sql`
      SELECT co.*, e.jobtread_job_id, e.name as estimate_name, e.client_name
      FROM change_orders co
      LEFT JOIN estimates e ON co.estimate_id = e.id
      WHERE co.id = ${id}
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Change order not found' }, { status: 404 });
    }

    const changeOrder = rows[0];

    if (!changeOrder.jobtread_job_id) {
      return Response.json({
        error: 'This estimate has not been synced to JobTread yet. Sync the estimate first.',
      }, { status: 400 });
    }

    const jobId = changeOrder.jobtread_job_id;

    // Build a detailed comment for JobTread
    const costImpact = parseFloat(changeOrder.cost_impact) || 0;
    const priceImpact = parseFloat(changeOrder.price_impact) || 0;
    const reasonLabels = {
      client_request: 'Client Request',
      unforeseen_conditions: 'Unforeseen Conditions',
      design_change: 'Design Change',
      material_substitution: 'Material Substitution',
    };

    const lines = [
      `[CHANGE ORDER] ${changeOrder.description}`,
      '',
      `Reason: ${reasonLabels[changeOrder.reason] || changeOrder.reason || 'Not specified'}`,
      `Cost Impact: ${costImpact >= 0 ? '+' : ''}$${costImpact.toFixed(2)}`,
      `Price Impact: ${priceImpact >= 0 ? '+' : ''}$${priceImpact.toFixed(2)}`,
      `Status: ${(changeOrder.status || 'draft').toUpperCase()}`,
    ];

    if (changeOrder.original_scope) {
      lines.push('', `Original Scope: ${changeOrder.original_scope}`);
    }
    if (changeOrder.new_scope) {
      lines.push(`New Scope: ${changeOrder.new_scope}`);
    }
    if (changeOrder.customer_explanation) {
      lines.push('', `Customer Explanation: ${changeOrder.customer_explanation}`);
    }

    const commentText = lines.join('\n');

    const comment = await addJobComment(grantKey, {
      jobId,
      text: commentText,
    });

    // Mark the change order as synced
    await sql`
      UPDATE change_orders SET jobtread_synced = true WHERE id = ${id}
    `;

    return Response.json({
      success: true,
      comment,
      message: 'Change order synced to JobTread',
    });
  } catch (error) {
    console.error('Change order sync error:', error);

    if (error.message?.includes('authentication')) {
      return Response.json({ error: 'JobTread authentication failed' }, { status: 401 });
    }

    return Response.json({ error: error.message || 'Failed to sync change order' }, { status: 500 });
  }
}
