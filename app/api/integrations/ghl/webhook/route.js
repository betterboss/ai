import { getSQL } from '../../../../lib/db';

export const runtime = 'edge';

// POST /api/integrations/ghl/webhook - Receive webhooks from GHL
export async function POST(request) {
  try {
    const body = await request.json();
    const sql = getSQL();

    // Ensure webhook_log table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ghl_webhook_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT,
          payload JSONB,
          status TEXT DEFAULT 'received',
          processed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    } catch { /* ok */ }

    // Log the incoming webhook
    const eventType = body.type || body.event || 'unknown';
    await sql`
      INSERT INTO ghl_webhook_log (event_type, payload, status)
      VALUES (${eventType}, ${JSON.stringify(body)}, 'received')
    `;

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'ContactCreate':
      case 'contact.create': {
        await handleNewContact(sql, body);
        break;
      }

      case 'ContactUpdate':
      case 'contact.update': {
        await handleContactUpdate(sql, body);
        break;
      }

      case 'OpportunityStatusUpdate':
      case 'opportunity.status_update': {
        await handleOpportunityStatusChange(sql, body);
        break;
      }

      case 'OpportunityCreate':
      case 'opportunity.create': {
        await handleNewOpportunity(sql, body);
        break;
      }

      default:
        // Log unhandled event types for debugging
        await sql`
          UPDATE ghl_webhook_log
          SET status = 'unhandled'
          WHERE event_type = ${eventType}
          AND created_at = (SELECT MAX(created_at) FROM ghl_webhook_log WHERE event_type = ${eventType})
        `;
        break;
    }

    // Always return 200 to acknowledge receipt
    return Response.json({ received: true });
  } catch (error) {
    console.error('GHL webhook error:', error);
    // Still return 200 to prevent GHL from retrying
    return Response.json({ received: true, error: error.message });
  }
}

async function handleNewContact(sql, body) {
  const contact = body.contact || body.data || body;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name;

  // Log the contact creation event for sync processing
  try {
    await sql`
      INSERT INTO ghl_sync_log (direction, entity_type, entity_id, status, details)
      VALUES ('ghl_to_jt', 'contact', ${contact.id || 'unknown'}, 'pending', ${name || 'Unknown contact'})
    `;
  } catch {
    // sync_log table may not exist yet
  }
}

async function handleContactUpdate(sql, body) {
  const contact = body.contact || body.data || body;

  try {
    await sql`
      INSERT INTO ghl_sync_log (direction, entity_type, entity_id, status, details)
      VALUES ('ghl_to_jt', 'contact_update', ${contact.id || 'unknown'}, 'pending', ${'Contact updated in GHL'})
    `;
  } catch { /* ok */ }
}

async function handleOpportunityStatusChange(sql, body) {
  const opp = body.opportunity || body.data || body;

  try {
    await sql`
      INSERT INTO ghl_sync_log (direction, entity_type, entity_id, status, details)
      VALUES ('ghl_to_jt', 'opportunity_status', ${opp.id || 'unknown'}, 'pending', ${`Status: ${opp.status || 'unknown'}`})
    `;
  } catch { /* ok */ }
}

async function handleNewOpportunity(sql, body) {
  const opp = body.opportunity || body.data || body;

  try {
    await sql`
      INSERT INTO ghl_sync_log (direction, entity_type, entity_id, status, details)
      VALUES ('ghl_to_jt', 'opportunity', ${opp.id || 'unknown'}, 'pending', ${opp.name || 'New opportunity'})
    `;
  } catch { /* ok */ }
}
