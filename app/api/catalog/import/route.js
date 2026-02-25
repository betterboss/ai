import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// POST /api/catalog/import - Import catalog items from parsed CSV data
export async function POST(request) {
  try {
    const { items, userId } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items array is required' }, { status: 400 });
    }

    const sql = getSQL();
    const inserted = [];

    for (const item of items) {
      const name = item.name || item.Name || item.ITEM || '';
      if (!name) continue;

      const description = item.description || item.Description || item.DESC || null;
      const category = normalizeCategory(item.category || item.Category || item.TYPE || 'material');
      const unit = item.unit || item.Unit || item.UOM || 'each';
      const unitCost = parseFloat(item.unit_cost || item['Unit Cost'] || item.COST || 0);
      const markupPct = parseFloat(item.markup_pct || item.Markup || item.MARKUP || 0);
      const supplier = item.supplier || item.Supplier || item.VENDOR || null;

      const rows = await sql`
        INSERT INTO catalog_items (user_id, name, description, category, unit, unit_cost, markup_pct, supplier)
        VALUES (${userId || null}, ${name}, ${description}, ${category}, ${unit}, ${unitCost}, ${markupPct}, ${supplier})
        RETURNING *
      `;
      inserted.push(rows[0]);
    }

    if (inserted.length === 0) {
      return Response.json({ error: 'No valid items found in import data' }, { status: 400 });
    }

    return Response.json({ imported: inserted.length, items: inserted }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function normalizeCategory(cat) {
  const lower = (cat || '').toLowerCase().trim();
  if (lower.includes('labor') || lower.includes('labour')) return 'labor';
  if (lower.includes('equip')) return 'equipment';
  if (lower.includes('sub')) return 'subcontractor';
  return 'material';
}
