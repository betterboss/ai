import { getServerClient } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/estimate/[id] - Get a single estimate with line items
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const db = getServerClient();

    const [estimateRes, itemsRes, takeoffsRes] = await Promise.all([
      db.from('estimates').select('*').eq('id', id).single(),
      db.from('estimate_items').select('*').eq('estimate_id', id).order('sort_order'),
      db.from('takeoffs').select('*').eq('estimate_id', id).order('created_at'),
    ]);

    if (estimateRes.error) throw estimateRes.error;

    return Response.json({
      estimate: estimateRes.data,
      items: itemsRes.data || [],
      takeoffs: takeoffsRes.data || [],
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
    const db = getServerClient();

    const { data, error } = await db.from('estimates')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ estimate: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/estimate/[id] - Delete an estimate and its line items (cascade)
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const db = getServerClient();

    const { error } = await db.from('estimates').delete().eq('id', id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
