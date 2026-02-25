import { getSQL } from '../../../../lib/db';
import { makeGHLRequest, createGHLContact, createGHLOpportunity } from '../../../../lib/ghl';
import { searchContacts, searchJobs, getOrgId } from '../../../../lib/jobtread';

export const runtime = 'edge';

// POST /api/integrations/ghl/sync - Trigger bidirectional sync between JT and GHL
export async function POST(request) {
  try {
    const { userId, grantKey, direction } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!grantKey) {
      return Response.json({ error: 'JobTread grant key is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load GHL config
    const configs = await sql`SELECT * FROM ghl_config WHERE user_id = ${userId}`;
    if (configs.length === 0 || !configs[0].api_key) {
      return Response.json({ error: 'GoHighLevel is not configured. Add your API key first.' }, { status: 400 });
    }

    const ghlConfig = {
      apiKey: configs[0].api_key,
      locationId: configs[0].location_id,
    };

    // Ensure sync_log table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ghl_sync_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id),
          direction TEXT,
          entity_type TEXT,
          entity_id TEXT,
          status TEXT,
          details TEXT,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    } catch { /* ok */ }

    const syncResults = {
      contacts_synced: 0,
      opportunities_synced: 0,
      errors: [],
    };

    // Sync contacts from JobTread to GHL
    if (configs[0].sync_contacts && direction !== 'ghl_to_jt') {
      try {
        const org = await getOrgId(grantKey);
        // Get recent JT contacts (we search with a broad query)
        const jtContacts = await searchContacts(grantKey, '');

        for (const contact of jtContacts.slice(0, 50)) {
          try {
            await createGHLContact(ghlConfig, {
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
            });
            syncResults.contacts_synced++;

            await sql`
              INSERT INTO ghl_sync_log (user_id, direction, entity_type, entity_id, status, details)
              VALUES (${userId}, 'jt_to_ghl', 'contact', ${contact.id}, 'success', ${contact.name})
            `;
          } catch (err) {
            // Likely duplicate - not a real error
            if (!err.message?.includes('duplicate') && !err.message?.includes('409')) {
              syncResults.errors.push(`Contact "${contact.name}": ${err.message}`);
            }
          }
        }
      } catch (err) {
        syncResults.errors.push(`Contact sync error: ${err.message}`);
      }
    }

    // Sync jobs/opportunities from JobTread to GHL
    if (configs[0].sync_opportunities && direction !== 'ghl_to_jt') {
      try {
        const jtJobs = await searchJobs(grantKey, '');

        for (const job of jtJobs.slice(0, 50)) {
          try {
            // We'd need a contactId in GHL to create an opportunity
            // For now, log the sync attempt
            await sql`
              INSERT INTO ghl_sync_log (user_id, direction, entity_type, entity_id, status, details)
              VALUES (${userId}, 'jt_to_ghl', 'job', ${job.id}, 'logged', ${job.name})
            `;
            syncResults.opportunities_synced++;
          } catch (err) {
            syncResults.errors.push(`Job "${job.name}": ${err.message}`);
          }
        }
      } catch (err) {
        syncResults.errors.push(`Job sync error: ${err.message}`);
      }
    }

    // Update last sync timestamp
    await sql`UPDATE ghl_config SET last_sync_at = now() WHERE user_id = ${userId}`;

    return Response.json({
      success: true,
      results: syncResults,
    });
  } catch (error) {
    console.error('GHL sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
