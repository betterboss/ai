import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const REVIEW_PROMPT = `You are an expert construction estimator reviewing an estimate before it is sent to a client. Analyze the line items and identify problems.

Check for:
1. MISSING ITEMS: Common materials/labor that should accompany existing items (e.g., tile without grout, thinset, or backer board; drywall without tape, mud, or sanding; painting without primer or prep; plumbing fixtures without supply lines or shut-off valves)
2. MISSING LABOR: Trades that should be included based on the materials listed (e.g., materials for electrical work but no electrician labor)
3. QUANTITY ISSUES: Quantities that seem unreasonable for the project (e.g., 10 sqft of flooring for what appears to be a full room)
4. MARGIN WARNINGS: Items with 0% or very low markup that should have markup applied
5. MISSING CLEANUP: Demolition or construction without cleanup/disposal line items
6. SCOPE GAPS: Standard items for this type of project that are completely absent

Return as JSON (no markdown, just pure JSON):
{
  "issues": [
    {
      "severity": "high",
      "type": "missing_item",
      "message": "Tile is listed but no grout, thinset, or backer board included",
      "suggestion": {
        "category": "Materials",
        "description": "Tile grout (sanded)",
        "quantity": 25,
        "unit": "lbs",
        "notes": "Based on 150 sqft of tile"
      }
    },
    {
      "severity": "medium",
      "type": "margin_warning",
      "message": "3 items have 0% markup applied",
      "suggestion": null
    }
  ],
  "summary": "Found 5 issues: 2 missing materials, 1 missing labor item, 1 quantity concern, 1 margin warning",
  "score": 72
}

severity: "high" = will likely cause problems, "medium" = worth reviewing, "low" = minor suggestion
score: 0-100 estimate completeness score (100 = no issues found)
Only include real issues. If the estimate looks complete, return an empty issues array and score of 95-100.`;

// POST /api/estimate/review - AI review of estimate before sync
export async function POST(request) {
  try {
    const { estimate, items, apiKey } = await request.json();

    if (!items || !items.length) {
      return Response.json({ error: 'Estimate has no line items to review' }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    // Build a summary of the estimate for Claude
    const itemSummary = items.map(item =>
      `- [${item.category || 'General'}] ${item.description}: ${item.quantity} ${item.unit} @ $${item.unit_cost}/unit, ${item.markup_pct}% markup`
    ).join('\n');

    const estimateContext = [
      `Project: ${estimate.name || 'Unnamed project'}`,
      estimate.job_address ? `Address: ${estimate.job_address}` : '',
      estimate.notes ? `Notes: ${estimate.notes}` : '',
      `Total Cost: $${estimate.total_cost || 0}`,
      `Total Price: $${estimate.total_price || 0}`,
      `\nLine Items (${items.length}):`,
      itemSummary,
    ].filter(Boolean).join('\n');

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${REVIEW_PROMPT}\n\nEstimate to review:\n${estimateContext}`
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { issues: [], summary: 'Unable to parse review', score: 0 };
    } catch {
      parsed = { issues: [], summary: 'Failed to parse AI response', score: 0 };
    }

    return Response.json({
      issues: parsed.issues || [],
      summary: parsed.summary || '',
      score: parsed.score ?? 50,
      usage: response.usage,
    });
  } catch (error) {
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
