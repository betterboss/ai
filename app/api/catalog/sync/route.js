import { getServerClient } from '../../../lib/db';
import { getCostCodes } from '../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/catalog/sync - Sync cost codes from JobTread into catalog
export async function POST(request) {
  try {
    const { grantKey, userId } = await request.json();

    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    // Fetch cost codes from JobTread
    const costCodes = await getCostCodes(grantKey);

    if (costCodes.length === 0) {
      return Response.json({ message: 'No cost codes found in JobTread', synced: 0 });
    }

    const db = getServerClient();

    // Get existing catalog items that already have JT cost code IDs
    const { data: existing } = await db.from('catalog_items')
      .select('jobtread_cost_code_id')
      .not('jobtread_cost_code_id', 'is', null);

    const existingIds = new Set((existing || []).map(e => e.jobtread_cost_code_id));

    // Only import cost codes that don't already exist
    const newCodes = costCodes.filter(cc => !existingIds.has(cc.id));

    if (newCodes.length === 0) {
      return Response.json({ message: 'All cost codes already synced', synced: 0 });
    }

    const rows = newCodes.map(cc => ({
      user_id: userId || null,
      name: cc.name,
      description: cc.description || null,
      category: 'material', // Default, user can recategorize
      unit: 'each',
      unit_cost: 0,
      markup_pct: 0,
      jobtread_cost_code_id: cc.id,
    }));

    const { data, error } = await db.from('catalog_items').insert(rows).select();
    if (error) throw error;

    return Response.json({
      synced: data.length,
      total_cost_codes: costCodes.length,
      items: data,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
