import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

// GET /api/integrations/ghl - Get GHL integration settings for user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Ensure ghl_config table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ghl_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          api_key TEXT,
          location_id TEXT,
          pipeline_id TEXT,
          stage_mapping JSONB DEFAULT '{}',
          sync_contacts BOOLEAN DEFAULT true,
          sync_opportunities BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(user_id)
        )
      `;
    } catch { /* table may exist */ }

    const rows = await sql`SELECT * FROM ghl_config WHERE user_id = ${userId}`;

    if (rows.length === 0) {
      return Response.json({ config: null });
    }

    // Mask the API key for security
    const config = rows[0];
    const maskedKey = config.api_key
      ? config.api_key.substring(0, 8) + '...' + config.api_key.substring(config.api_key.length - 4)
      : null;

    return Response.json({
      config: {
        ...config,
        api_key_masked: maskedKey,
        api_key: undefined,
        has_api_key: !!config.api_key,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/integrations/ghl - Save/update GHL config
export async function POST(request) {
  try {
    const { userId, apiKey, locationId, pipelineId, stageMapping, syncContacts, syncOpportunities } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ghl_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          api_key TEXT,
          location_id TEXT,
          pipeline_id TEXT,
          stage_mapping JSONB DEFAULT '{}',
          sync_contacts BOOLEAN DEFAULT true,
          sync_opportunities BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(user_id)
        )
      `;
    } catch { /* ok */ }

    // Check if config exists
    const existing = await sql`SELECT id FROM ghl_config WHERE user_id = ${userId}`;

    let result;
    if (existing.length > 0) {
      // Update
      result = await sql`
        UPDATE ghl_config SET
          api_key = COALESCE(${apiKey || null}, api_key),
          location_id = COALESCE(${locationId || null}, location_id),
          pipeline_id = COALESCE(${pipelineId || null}, pipeline_id),
          stage_mapping = COALESCE(${stageMapping ? JSON.stringify(stageMapping) : null}::jsonb, stage_mapping),
          sync_contacts = COALESCE(${syncContacts !== undefined ? syncContacts : null}, sync_contacts),
          sync_opportunities = COALESCE(${syncOpportunities !== undefined ? syncOpportunities : null}, sync_opportunities),
          updated_at = now()
        WHERE user_id = ${userId}
        RETURNING id
      `;
    } else {
      // Insert
      result = await sql`
        INSERT INTO ghl_config (user_id, api_key, location_id, pipeline_id, stage_mapping, sync_contacts, sync_opportunities)
        VALUES (
          ${userId},
          ${apiKey || null},
          ${locationId || null},
          ${pipelineId || null},
          ${JSON.stringify(stageMapping || {})}::jsonb,
          ${syncContacts !== false},
          ${syncOpportunities !== false}
        )
        RETURNING id
      `;
    }

    return Response.json({ success: true, id: result[0]?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
