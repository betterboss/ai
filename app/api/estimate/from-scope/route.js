import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const SCOPE_PROMPT = `You are an expert construction estimator. Given a scope of work description, extract ALL line items needed for the estimate.

For each item, provide:
- category: The cost group (Materials, Labor, Electrical, Plumbing, Fixtures, Finishes, Demolition, etc.)
- description: Specific item name
- quantity: Estimated quantity based on the scope
- unit: Unit of measure (sqft, lf, each, hour, etc.)
- notes: Any assumptions you made about the quantity

Be thorough — include:
- All materials mentioned or implied
- Labor for each trade involved
- Demolition/removal if the scope implies it
- Ancillary items (fasteners, adhesives, prep materials like thinset, grout, backer board for tile)
- Cleanup and disposal

Return as JSON (no markdown, just pure JSON):
{
  "project_type": "Kitchen Remodel",
  "items": [
    { "category": "Demolition", "description": "Demo existing cabinets", "quantity": 1, "unit": "lot", "notes": "Assumed standard kitchen" },
    { "category": "Materials", "description": "Porcelain tile 12x24", "quantity": 150, "unit": "sqft", "notes": "Floor area estimate" }
  ],
  "assumptions": [
    "Standard 10x15 kitchen assumed where dimensions not specified",
    "Standard grade materials unless otherwise noted"
  ]
}`;

// POST /api/estimate/from-scope - Generate line items from a text scope of work
export async function POST(request) {
  try {
    const { scope, apiKey } = await request.json();

    if (!scope) {
      return Response.json({ error: 'Scope of work text is required' }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${SCOPE_PROMPT}\n\nScope of Work:\n${scope}`
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Parse JSON from response
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [], error: 'Failed to parse AI response' };
    }

    return Response.json({
      items: parsed.items || [],
      project_type: parsed.project_type || 'General',
      assumptions: parsed.assumptions || [],
      usage: response.usage,
    });
  } catch (error) {
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
