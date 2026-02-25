import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

const TONE_INSTRUCTIONS = {
  professional: 'Use a formal, polished tone. Be concise and authoritative. Address the client respectfully with proper titles where applicable.',
  friendly: 'Use a warm, approachable tone. Be conversational but still competent. Make the client feel like they are working with a trusted neighbor.',
  urgent: 'Emphasize time-sensitivity and limited availability. Create urgency around scheduling and material pricing without being pushy. Highlight why acting now is in the client\'s best interest.',
};

// POST /api/write/proposal - Generate a full professional proposal from an estimate
export async function POST(request) {
  try {
    const { estimateId, tone, includeTerms, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!estimateId) {
      return Response.json({ error: 'Estimate ID is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load estimate + line items
    const [estimates, items] = await Promise.all([
      sql`SELECT * FROM estimates WHERE id = ${estimateId}`,
      sql`SELECT * FROM estimate_items WHERE estimate_id = ${estimateId} ORDER BY sort_order`,
    ]);

    if (estimates.length === 0) {
      return Response.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const estimate = estimates[0];

    // Load user company info if available
    let companyName = 'Our Company';
    let companyInfo = '';
    if (estimate.user_id) {
      const users = await sql`SELECT company_name, email FROM users WHERE id = ${estimate.user_id}`;
      if (users.length > 0 && users[0].company_name) {
        companyName = users[0].company_name;
        companyInfo = `Company: ${users[0].company_name}\nContact Email: ${users[0].email || 'N/A'}`;
      }
    }

    // Group items by category
    const grouped = {};
    items.forEach(item => {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    const itemSummary = Object.entries(grouped).map(([category, catItems]) => {
      const catTotal = catItems.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
      const lines = catItems.map(i =>
        `  - ${i.description}: ${i.quantity} ${i.unit} — $${parseFloat(i.total_price || 0).toFixed(2)}`
      ).join('\n');
      return `[${category}] (Subtotal: $${catTotal.toFixed(2)})\n${lines}`;
    }).join('\n\n');

    const totalPrice = parseFloat(estimate.total_price || 0);
    const totalCost = parseFloat(estimate.total_cost || 0);
    const toneGuide = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;

    const prompt = `You are an expert construction proposal writer. Generate a complete, professional proposal document in HTML format.

## CONTEXT
Company Name: ${companyName}
${companyInfo}
Project Name: ${estimate.name || 'Construction Project'}
Client Name: ${estimate.client_name || 'Valued Customer'}
Client Email: ${estimate.client_email || ''}
Client Phone: ${estimate.client_phone || ''}
Job Address: ${estimate.job_address || 'Project Site'}
Total Price: $${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Estimate Notes: ${estimate.notes || 'None'}

## LINE ITEMS BY CATEGORY
${itemSummary}

## TONE
${toneGuide}

## REQUIREMENTS
Generate a complete HTML proposal document with the following sections:

1. **Cover Letter** (2-3 paragraphs)
   - Thank the client for the opportunity
   - Briefly summarize what you understand about their project needs
   - Express confidence and enthusiasm about the project

2. **Scope of Work Summary**
   - Write a narrative summary of the work to be performed (do NOT just list line items)
   - Group related work together logically
   - Use plain language the client can understand

3. **Detailed Pricing Table**
   - Group line items by category
   - Show description, quantity, unit, and price for each item
   - Show category subtotals
   - Show grand total prominently

${includeTerms ? `4. **Terms & Conditions**
   - Payment terms (50% deposit, balance on completion)
   - Estimate validity (30 days)
   - Change order policy
   - Warranty information (1 year workmanship)
   - Insurance and licensing statement
   - Dispute resolution
   - Cancellation policy` : ''}

5. **Call to Action**
   - Clear next steps for the client to approve
   - Signature lines for both parties
   - Date fields

## HTML FORMAT RULES
- Use clean, semantic HTML with inline styles
- Use a white background (#ffffff) with dark text (#1a1a1a)
- Use #5d47fa as the accent color for headings and highlights
- Use professional fonts: font-family: 'Inter', -apple-system, sans-serif
- Tables should be well-formatted with proper borders and padding
- Make it print-friendly
- Do NOT include <html>, <head>, or <body> tags — just the inner content div
- Wrap everything in a single <div> with max-width: 800px and margin: 0 auto`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const htmlContent = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Extract the HTML from possible markdown code fences
    let proposalHtml = htmlContent;
    const htmlMatch = htmlContent.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      proposalHtml = htmlMatch[1].trim();
    }

    // Generate a plain text version by stripping tags
    const proposalText = proposalHtml
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/th>/gi, '\t')
      .replace(/<\/td>/gi, '\t')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '  - ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return Response.json({
      proposal_html: proposalHtml,
      proposal_text: proposalText,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Proposal generation error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate proposal' }, { status: 500 });
  }
}
