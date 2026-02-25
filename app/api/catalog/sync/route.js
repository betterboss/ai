import { getSQL } from '../../../lib/db';
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

    const sql = getSQL();

    // Get existing catalog items that already have JT cost code IDs
    const existing = await sql`
      SELECT jobtread_cost_code_id FROM catalog_items
      WHERE jobtread_cost_code_id IS NOT NULL
    `;
    const existingIds = new Set(existing.map(e => e.jobtread_cost_code_id));

    // Only import cost codes that don't already exist
    const newCodes = costCodes.filter(cc => !existingIds.has(cc.id));

    if (newCodes.length === 0) {
      return Response.json({ message: 'All cost codes already synced', synced: 0 });
    }

    const inserted = [];
    for (const cc of newCodes) {
      const rows = await sql`
        INSERT INTO catalog_items (user_id, name, description, category, unit, unit_cost, markup_pct, jobtread_cost_code_id)
        VALUES (${userId || null}, ${cc.name}, ${cc.description || null}, 'material', 'each', 0, 0, ${cc.id})
        RETURNING *
      `;
      inserted.push(rows[0]);
    }

    return Response.json({
      synced: inserted.length,
      total_cost_codes: costCodes.length,
      items: inserted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
