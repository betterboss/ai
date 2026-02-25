import { getServerClient } from '../../../../lib/db';

export const runtime = 'edge';

// GET /api/estimate/[id]/items - List all line items for an estimate
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const db = getServerClient();

    const { data, error } = await db.from('estimate_items')
      .select('*')
      .eq('estimate_id', id)
      .order('sort_order');

    if (error) throw error;
    return Response.json({ items: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/estimate/[id]/items - Add line items (single or batch)
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const db = getServerClient();

    // Support single item or array of items
    const items = Array.isArray(body.items) ? body.items : [body];

    const rows = items.map((item, index) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unit_cost) || 0;
      const markupPct = parseFloat(item.markup_pct) || 0;
      const totalCost = quantity * unitCost;
      const totalPrice = totalCost * (1 + markupPct / 100);

      return {
        estimate_id: id,
        category: item.category || 'General',
        description: item.description,
        quantity,
        unit: item.unit || 'each',
        unit_cost: unitCost,
        markup_pct: markupPct,
        total_cost: Math.round(totalCost * 100) / 100,
        total_price: Math.round(totalPrice * 100) / 100,
        source: item.source || 'manual',
        catalog_item_id: item.catalog_item_id || null,
        sort_order: item.sort_order ?? index,
      };
    });

    const { data, error } = await db.from('estimate_items').insert(rows).select();
    if (error) throw error;

    // Recalculate estimate totals
    await recalcEstimateTotals(db, id);

    return Response.json({ items: data }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/estimate/[id]/items - Update a line item (pass item id in body)
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const db = getServerClient();

    if (!body.item_id) {
      return Response.json({ error: 'item_id is required' }, { status: 400 });
    }

    // Recalculate derived fields
    const quantity = parseFloat(body.quantity) || 0;
    const unitCost = parseFloat(body.unit_cost) || 0;
    const markupPct = parseFloat(body.markup_pct) || 0;
    const totalCost = quantity * unitCost;
    const totalPrice = totalCost * (1 + markupPct / 100);

    const updateData = { ...body };
    delete updateData.item_id;
    updateData.total_cost = Math.round(totalCost * 100) / 100;
    updateData.total_price = Math.round(totalPrice * 100) / 100;

    const { data, error } = await db.from('estimate_items')
      .update(updateData)
      .eq('id', body.item_id)
      .eq('estimate_id', id)
      .select()
      .single();

    if (error) throw error;

    await recalcEstimateTotals(db, id);

    return Response.json({ item: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/estimate/[id]/items?item_id=xxx - Delete a line item
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');

    if (!itemId) {
      return Response.json({ error: 'item_id query param is required' }, { status: 400 });
    }

    const db = getServerClient();
    const { error } = await db.from('estimate_items')
      .delete()
      .eq('id', itemId)
      .eq('estimate_id', id);

    if (error) throw error;

    await recalcEstimateTotals(db, id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Recalculate estimate totals from line items
async function recalcEstimateTotals(db, estimateId) {
  const { data: items } = await db.from('estimate_items')
    .select('total_cost, total_price')
    .eq('estimate_id', estimateId);

  const totalCost = (items || []).reduce((sum, i) => sum + (parseFloat(i.total_cost) || 0), 0);
  const totalPrice = (items || []).reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
  const marginPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

  await db.from('estimates').update({
    total_cost: Math.round(totalCost * 100) / 100,
    total_price: Math.round(totalPrice * 100) / 100,
    margin_pct: Math.round(marginPct * 100) / 100,
    updated_at: new Date().toISOString(),
  }).eq('id', estimateId);
}
