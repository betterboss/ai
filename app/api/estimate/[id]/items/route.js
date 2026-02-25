import { getSQL } from '../../../../lib/db';

export const runtime = 'edge';

// GET /api/estimate/[id]/items - List all line items for an estimate
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const sql = getSQL();

    const rows = await sql`
      SELECT * FROM estimate_items
      WHERE estimate_id = ${id}
      ORDER BY sort_order
    `;

    return Response.json({ items: rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/estimate/[id]/items - Add line items (single or batch)
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const sql = getSQL();

    const items = Array.isArray(body.items) ? body.items : [body];
    const inserted = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const quantity = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unit_cost) || 0;
      const markupPct = parseFloat(item.markup_pct) || 0;
      const totalCost = Math.round(quantity * unitCost * 100) / 100;
      const totalPrice = Math.round(totalCost * (1 + markupPct / 100) * 100) / 100;

      const rows = await sql`
        INSERT INTO estimate_items (estimate_id, category, description, quantity, unit, unit_cost, markup_pct, total_cost, total_price, source, catalog_item_id, sort_order)
        VALUES (${id}, ${item.category || 'General'}, ${item.description}, ${quantity}, ${item.unit || 'each'}, ${unitCost}, ${markupPct}, ${totalCost}, ${totalPrice}, ${item.source || 'manual'}, ${item.catalog_item_id || null}, ${item.sort_order ?? i})
        RETURNING *
      `;
      inserted.push(rows[0]);
    }

    await recalcEstimateTotals(sql, id);

    return Response.json({ items: inserted }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/estimate/[id]/items - Update a line item (pass item_id in body)
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const sql = getSQL();

    if (!body.item_id) {
      return Response.json({ error: 'item_id is required' }, { status: 400 });
    }

    const quantity = parseFloat(body.quantity) || 0;
    const unitCost = parseFloat(body.unit_cost) || 0;
    const markupPct = parseFloat(body.markup_pct) || 0;
    const totalCost = Math.round(quantity * unitCost * 100) / 100;
    const totalPrice = Math.round(totalCost * (1 + markupPct / 100) * 100) / 100;

    const rows = await sql`
      UPDATE estimate_items SET
        category = ${body.category || 'General'},
        description = ${body.description},
        quantity = ${quantity},
        unit = ${body.unit || 'each'},
        unit_cost = ${unitCost},
        markup_pct = ${markupPct},
        total_cost = ${totalCost},
        total_price = ${totalPrice}
      WHERE id = ${body.item_id} AND estimate_id = ${id}
      RETURNING *
    `;

    await recalcEstimateTotals(sql, id);

    return Response.json({ item: rows[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/estimate/[id]/items?item_id=xxx
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return Response.json({ error: 'item_id query param is required' }, { status: 400 });
    }

    const sql = getSQL();
    await sql`DELETE FROM estimate_items WHERE id = ${itemId} AND estimate_id = ${id}`;

    await recalcEstimateTotals(sql, id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Recalculate estimate totals from line items
async function recalcEstimateTotals(sql, estimateId) {
  const result = await sql`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_price), 0) as total_price
    FROM estimate_items
    WHERE estimate_id = ${estimateId}
  `;

  const totalCost = parseFloat(result[0].total_cost) || 0;
  const totalPrice = parseFloat(result[0].total_price) || 0;
  const marginPct = totalPrice > 0 ? Math.round(((totalPrice - totalCost) / totalPrice) * 10000) / 100 : 0;

  await sql`
    UPDATE estimates SET
      total_cost = ${totalCost},
      total_price = ${totalPrice},
      margin_pct = ${marginPct},
      updated_at = now()
    WHERE id = ${estimateId}
  `;
}
