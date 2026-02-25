import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

const REASON_LABELS = {
  client_request: 'Client Request',
  unforeseen_conditions: 'Unforeseen Site Conditions',
  design_change: 'Design Change',
  material_substitution: 'Material Substitution',
};

// POST /api/write/change-order - Generate change order documents
export async function POST(request) {
  try {
    const { estimateId, description, reason, addedItems, removedItems, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!estimateId) {
      return Response.json({ error: 'Estimate ID is required' }, { status: 400 });
    }
    if (!description) {
      return Response.json({ error: 'Change order description is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load estimate
    const estimates = await sql`SELECT * FROM estimates WHERE id = ${estimateId}`;
    if (estimates.length === 0) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const estimate = estimates[0];
    const reasonLabel = REASON_LABELS[reason] || reason || 'Change Order';

    // Calculate cost impact
    const addedTotal = (addedItems || []).reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      const markup = parseFloat(item.markup_pct) || 0;
      return sum + (qty * cost * (1 + markup / 100));
    }, 0);

    const removedTotal = (removedItems || []).reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      const markup = parseFloat(item.markup_pct) || 0;
      return sum + (qty * cost * (1 + markup / 100));
    }, 0);

    const netImpact = addedTotal - removedTotal;
    const originalTotal = parseFloat(estimate.total_price || 0);
    const newTotal = originalTotal + netImpact;

    // Build items summary for AI
    const addedSummary = (addedItems || []).map(i =>
      `  + ${i.description}: ${i.quantity} ${i.unit || 'each'} @ $${i.unit_cost}/${i.unit || 'each'} (${i.markup_pct || 0}% markup)`
    ).join('\n') || '  (none)';

    const removedSummary = (removedItems || []).map(i =>
      `  - ${i.description}: ${i.quantity} ${i.unit || 'each'} @ $${i.unit_cost}/${i.unit || 'each'}`
    ).join('\n') || '  (none)';

    const prompt = `You are an expert construction change order writer. Generate a formal change order document.

## CONTEXT
Project: ${estimate.name || 'Construction Project'}
Client: ${estimate.client_name || 'Client'}
Job Address: ${estimate.job_address || 'Project Site'}
Original Contract Total: $${originalTotal.toFixed(2)}
Reason for Change: ${reasonLabel}
Description: ${description}

## ITEMS ADDED
${addedSummary}
Added Total: $${addedTotal.toFixed(2)}

## ITEMS REMOVED / CREDITS
${removedSummary}
Credit Total: $${removedTotal.toFixed(2)}

## NET IMPACT
Net Change: ${netImpact >= 0 ? '+' : ''}$${netImpact.toFixed(2)}
New Contract Total: $${newTotal.toFixed(2)}

## REQUIREMENTS
Generate an HTML document with:

1. **Change Order Header**
   - Change order number placeholder (CO-001)
   - Date
   - Project reference
   - Client name and address

2. **Formal Narrative** (2-3 paragraphs)
   - Describe what is changing and why
   - Be clear and specific
   - Use professional construction language
   - Reference the reason category appropriately

3. **Cost Impact Table**
   - Added items with pricing
   - Removed items / credits
   - Net change amount
   - Original contract total
   - New contract total

4. **Customer-Facing Explanation** (1-2 paragraphs)
   - Explain the change in plain, client-friendly language
   - Address how this benefits or protects the client
   - Be transparent about cost impact

5. **Authorization Section**
   - Statement that work will not proceed until signed
   - Timeline impact notice if applicable
   - Signature lines for both parties with dates

## HTML FORMAT
- Use clean HTML with inline styles
- White background (#ffffff), dark text (#1a1a1a)
- Accent color: #5d47fa
- Font: 'Inter', -apple-system, sans-serif
- Print-friendly layout
- No <html>, <head>, or <body> tags
- Wrap in a single <div> with max-width: 800px`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6144,
      messages: [{ role: 'user', content: prompt }],
    });

    const htmlContent = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Extract HTML from possible code fences
    let documentHtml = htmlContent;
    const htmlMatch = htmlContent.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      documentHtml = htmlMatch[1].trim();
    }

    // Save the change order to the database
    // First ensure the change_orders table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS change_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          reason TEXT,
          added_items JSONB DEFAULT '[]',
          removed_items JSONB DEFAULT '[]',
          added_total DECIMAL(12,2) DEFAULT 0,
          removed_total DECIMAL(12,2) DEFAULT 0,
          net_impact DECIMAL(12,2) DEFAULT 0,
          original_total DECIMAL(12,2) DEFAULT 0,
          new_total DECIMAL(12,2) DEFAULT 0,
          document_html TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    } catch {
      // Table may already exist, continue
    }

    const changeOrderRows = await sql`
      INSERT INTO change_orders (estimate_id, description, reason, added_items, removed_items, added_total, removed_total, net_impact, original_total, new_total, document_html, status)
      VALUES (
        ${estimateId},
        ${description},
        ${reason || 'other'},
        ${JSON.stringify(addedItems || [])},
        ${JSON.stringify(removedItems || [])},
        ${addedTotal},
        ${removedTotal},
        ${netImpact},
        ${originalTotal},
        ${newTotal},
        ${documentHtml},
        'pending'
      )
      RETURNING *
    `;

    return Response.json({
      changeOrder: changeOrderRows[0],
      document_html: documentHtml,
      cost_summary: {
        added_total: addedTotal,
        removed_total: removedTotal,
        net_impact: netImpact,
        original_total: originalTotal,
        new_total: newTotal,
      },
      usage: response.usage,
    });
  } catch (error) {
    console.error('Change order generation error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate change order' }, { status: 500 });
  }
}
