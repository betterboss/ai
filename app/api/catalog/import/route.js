import { getServerClient } from '../../../lib/db';

export const runtime = 'edge';

// POST /api/catalog/import - Import catalog items from CSV
// Expects JSON body with { items: [...], userId: "..." }
// CSV parsing should be done client-side; this receives structured data
export async function POST(request) {
  try {
    const { items, userId } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items array is required' }, { status: 400 });
    }

    const db = getServerClient();

    const rows = items.map(item => ({
      user_id: userId || null,
      name: item.name || item.Name || item.ITEM || '',
      description: item.description || item.Description || item.DESC || null,
      category: normalizeCategory(item.category || item.Category || item.TYPE || 'material'),
      unit: item.unit || item.Unit || item.UOM || 'each',
      unit_cost: parseFloat(item.unit_cost || item['Unit Cost'] || item.COST || 0),
      markup_pct: parseFloat(item.markup_pct || item.Markup || item.MARKUP || 0),
      supplier: item.supplier || item.Supplier || item.VENDOR || null,
    })).filter(row => row.name); // Skip rows without a name

    if (rows.length === 0) {
      return Response.json({ error: 'No valid items found in import data' }, { status: 400 });
    }

    const { data, error } = await db.from('catalog_items').insert(rows).select();
    if (error) throw error;

    return Response.json({
      imported: data.length,
      items: data,
    }, { status: 201 });
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
