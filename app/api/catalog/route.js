import { getServerClient } from '../../lib/db';

export const runtime = 'edge';

// GET /api/catalog - List catalog items
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const userId = searchParams.get('userId');

    const db = getServerClient();
    let query = db.from('catalog_items').select('*').order('category').order('name');

    if (category) query = query.eq('category', category);
    if (userId) query = query.eq('user_id', userId);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ items: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/catalog - Create a catalog item
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, category, unit, unit_cost, markup_pct, supplier, user_id, jobtread_cost_code_id } = body;

    if (!name) {
      return Response.json({ error: 'Item name is required' }, { status: 400 });
    }

    const db = getServerClient();
    const { data, error } = await db.from('catalog_items').insert({
      name,
      description: description || null,
      category: category || 'material',
      unit: unit || 'each',
      unit_cost: parseFloat(unit_cost) || 0,
      markup_pct: parseFloat(markup_pct) || 0,
      supplier: supplier || null,
      user_id: user_id || null,
      jobtread_cost_code_id: jobtread_cost_code_id || null,
    }).select().single();

    if (error) throw error;

    return Response.json({ item: data }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/catalog - Update a catalog item (pass id in body)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ error: 'Item id is required' }, { status: 400 });
    }

    const db = getServerClient();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await db.from('catalog_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return Response.json({ item: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/catalog?id=xxx
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'id query param is required' }, { status: 400 });
    }

    const db = getServerClient();
    const { error } = await db.from('catalog_items').delete().eq('id', id);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
