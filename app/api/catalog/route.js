import { getSQL } from '../../lib/db';

export const runtime = 'edge';

// GET /api/catalog - List catalog items
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const userId = searchParams.get('userId');
    const sql = getSQL();

    let rows;
    if (category && search) {
      rows = await sql`SELECT * FROM catalog_items WHERE category = ${category} AND name ILIKE ${'%' + search + '%'} ORDER BY category, name`;
    } else if (category) {
      rows = await sql`SELECT * FROM catalog_items WHERE category = ${category} ORDER BY category, name`;
    } else if (search) {
      rows = await sql`SELECT * FROM catalog_items WHERE name ILIKE ${'%' + search + '%'} ORDER BY category, name`;
    } else if (userId) {
      rows = await sql`SELECT * FROM catalog_items WHERE user_id = ${userId} ORDER BY category, name`;
    } else {
      rows = await sql`SELECT * FROM catalog_items ORDER BY category, name`;
    }

    return Response.json({ items: rows });
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

    const sql = getSQL();
    const rows = await sql`
      INSERT INTO catalog_items (name, description, category, unit, unit_cost, markup_pct, supplier, user_id, jobtread_cost_code_id)
      VALUES (${name}, ${description || null}, ${category || 'material'}, ${unit || 'each'}, ${parseFloat(unit_cost) || 0}, ${parseFloat(markup_pct) || 0}, ${supplier || null}, ${user_id || null}, ${jobtread_cost_code_id || null})
      RETURNING *
    `;

    return Response.json({ item: rows[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/catalog - Update a catalog item (pass id in body)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: 'Item id is required' }, { status: 400 });
    }

    const sql = getSQL();
    const rows = await sql`
      UPDATE catalog_items SET
        name = COALESCE(${body.name || null}, name),
        description = COALESCE(${body.description || null}, description),
        category = COALESCE(${body.category || null}, category),
        unit = COALESCE(${body.unit || null}, unit),
        unit_cost = COALESCE(${body.unit_cost !== undefined ? parseFloat(body.unit_cost) : null}, unit_cost),
        markup_pct = COALESCE(${body.markup_pct !== undefined ? parseFloat(body.markup_pct) : null}, markup_pct),
        supplier = COALESCE(${body.supplier || null}, supplier),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({ item: rows[0] });
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

    const sql = getSQL();
    await sql`DELETE FROM catalog_items WHERE id = ${id}`;

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
