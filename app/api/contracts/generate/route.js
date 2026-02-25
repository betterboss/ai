import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

export const runtime = 'nodejs';

// POST /api/contracts/generate - Generate a full contract document
export async function POST(request) {
  try {
    const { apiKey, projectType, clientName, jobName, clauseIds, customTerms } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!projectType) {
      return Response.json({ error: 'Project type is required' }, { status: 400 });
    }
    if (!clientName) {
      return Response.json({ error: 'Client name is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Load selected clauses from the database
    let clauses = [];
    if (clauseIds && clauseIds.length > 0) {
      clauses = await sql`
        SELECT * FROM contract_clauses
        WHERE id = ANY(${clauseIds})
        ORDER BY category ASC, title ASC
      `;
    }

    const clauseSection = clauses.length > 0
      ? clauses.map((c, i) => `
Clause ${i + 1} - ${c.title} (${c.category}):
${c.clause_text}
`).join('\n')
      : 'No specific clauses selected. Generate standard clauses for this project type.';

    const customTermsSection = customTerms
      ? `\n\nAdditional custom terms to incorporate:\n${customTerms}`
      : '';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are a construction contract attorney. Generate a complete, professional construction contract document.

Project Details:
- Type: ${projectType}
- Client: ${clientName}
- Job/Project Name: ${jobName || 'Construction Project'}

Selected Clauses to Include:
${clauseSection}
${customTermsSection}

Generate a complete construction contract in HTML format. The contract should:
1. Have a professional header with project details
2. Include all standard sections (parties, scope, timeline, payment terms, etc.)
3. Incorporate all the selected clauses naturally into the appropriate sections
4. Include signature blocks at the end
5. Use clean, semantic HTML with inline styles for print-friendliness
6. Use a professional font stack and layout

Return your response as a JSON object with two fields:
- "contract_html": The complete contract in styled HTML
- "contract_text": A plain text version of the same contract

Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    const responseText = message.content[0].text.trim();

    let result;
    try {
      const jsonStr = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      // If JSON parsing fails, treat the whole response as HTML
      return Response.json({
        contract_html: responseText,
        contract_text: responseText.replace(/<[^>]+>/g, ''),
      });
    }

    return Response.json({
      contract_html: result.contract_html,
      contract_text: result.contract_text,
    });
  } catch (error) {
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
