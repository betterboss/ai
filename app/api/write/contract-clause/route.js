import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

export const runtime = 'edge';

const CONCERN_DESCRIPTIONS = {
  payment: 'Payment terms, deposit requirements, late payment penalties, lien rights',
  delays: 'Schedule delays, force majeure, weather delays, material lead times',
  material_prices: 'Material price escalation, cost adjustment clauses, substitution rights',
  scope_changes: 'Change order procedures, scope creep protection, additional work authorization',
  warranty: 'Workmanship warranty, material warranty, exclusions, claim procedures',
  liability: 'Limitation of liability, indemnification, insurance requirements',
  termination: 'Contract termination conditions, cancellation fees, wind-down procedures',
  disputes: 'Dispute resolution, mediation, arbitration, governing law',
  safety: 'Jobsite safety, OSHA compliance, hazardous materials, client responsibilities',
  permits: 'Permit responsibilities, inspection requirements, code compliance',
  subcontractors: 'Subcontractor management, pass-through clauses, direct payment',
  insurance: 'Insurance requirements, additional insured, certificate of insurance',
};

// POST /api/write/contract-clause - Suggest contract clauses
export async function POST(request) {
  try {
    const { projectType, concerns, apiKey } = await request.json();

    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }
    if (!concerns || !Array.isArray(concerns) || concerns.length === 0) {
      return Response.json({ error: 'At least one concern is required' }, { status: 400 });
    }

    const sql = getSQL();

    // Try to load default clauses from contract_clauses table
    let defaultClauses = [];
    try {
      // Ensure table exists
      await sql`
        CREATE TABLE IF NOT EXISTS contract_clauses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          category TEXT,
          clause_text TEXT NOT NULL,
          when_to_use TEXT,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `;

      defaultClauses = await sql`
        SELECT title, category, clause_text, when_to_use
        FROM contract_clauses
        WHERE is_default = true
        ORDER BY category, title
      `;
    } catch {
      // Table may not exist yet, continue without defaults
    }

    const concernDetails = concerns.map(c => {
      const desc = CONCERN_DESCRIPTIONS[c];
      return desc ? `- ${c}: ${desc}` : `- ${c}`;
    }).join('\n');

    const defaultClauseSummary = defaultClauses.length > 0
      ? `\n\n## EXISTING DEFAULT CLAUSES (for reference, do NOT duplicate these)\n${defaultClauses.map(c => `- [${c.category}] ${c.title}: ${c.clause_text.substring(0, 100)}...`).join('\n')}`
      : '';

    const prompt = `You are an expert construction contract attorney helping a contractor build protective contract clauses.

## PROJECT TYPE
${projectType || 'General Construction'}

## CONCERNS TO ADDRESS
${concernDetails}
${defaultClauseSummary}

## REQUIREMENTS
Generate contract clauses that:
1. Are legally sound but written in plain English
2. Protect the contractor while being fair to the client
3. Are specific to the ${projectType || 'construction'} project type
4. Include practical enforcement mechanisms
5. Are organized by concern category

For EACH concern listed above, generate 1-2 specific clauses.

Return your response in this EXACT JSON format (no markdown, just pure JSON):
{
  "clauses": [
    {
      "title": "Short descriptive title for the clause",
      "category": "The concern category this addresses",
      "clause_text": "The full legal clause text, written in plain English but legally sound. Include specific numbers, timeframes, and procedures where appropriate.",
      "when_to_use": "Brief guidance on when this clause is most important and why"
    }
  ]
}

Generate practical, real-world clauses that a contractor can actually use. Do NOT generate generic placeholder text. Each clause should be 2-5 sentences and include specific terms (dollar amounts as placeholders like $X, timeframes like X days, etc.).`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6144,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.clauses)) {
      return Response.json({
        error: 'Failed to parse AI response. Please try again.',
      }, { status: 500 });
    }

    // Combine default clauses with AI-generated ones
    const allClauses = [
      ...defaultClauses.map(c => ({
        title: c.title,
        category: c.category,
        clause_text: c.clause_text,
        when_to_use: c.when_to_use || 'Default clause — included in all contracts',
        source: 'default',
      })),
      ...parsed.clauses.map(c => ({
        ...c,
        source: 'ai_generated',
      })),
    ];

    return Response.json({
      clauses: allClauses,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Contract clause generation error:', error);

    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded. Please wait and try again.' }, { status: 429 });
    }

    return Response.json({ error: error.message || 'Failed to generate clauses' }, { status: 500 });
  }
}
