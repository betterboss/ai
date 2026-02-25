import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from '../../../lib/db';

// Switch to nodejs runtime so we can use RAG (OpenAI embeddings require Node)
export const runtime = 'nodejs';

const SCOPE_PROMPT = `You are an expert construction estimator. Given a scope of work description, extract ALL line items needed for the estimate.

For each item, provide:
- category: The cost group (Materials, Labor, Electrical, Plumbing, Fixtures, Finishes, Demolition, etc.)
- description: Specific item name
- quantity: Estimated quantity based on the scope
- unit: Unit of measure (sqft, lf, each, hour, etc.)
- unit_cost: Estimated unit cost in dollars (use your best judgment for market rates, or match catalog pricing if provided)
- markup_pct: Suggested markup percentage
- notes: Any assumptions you made about the quantity
- catalog_match: If a user catalog is provided, set this to the EXACT catalog item name that best matches, or null if no match

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
    { "category": "Demolition", "description": "Demo existing cabinets", "quantity": 1, "unit": "lot", "unit_cost": 500, "markup_pct": 25, "notes": "Assumed standard kitchen", "catalog_match": null },
    { "category": "Materials", "description": "Porcelain tile 12x24", "quantity": 150, "unit": "sqft", "unit_cost": 4.50, "markup_pct": 25, "notes": "Floor area estimate", "catalog_match": "Porcelain Tile 12x24" }
  ],
  "assumptions": [
    "Standard 10x15 kitchen assumed where dimensions not specified",
    "Standard grade materials unless otherwise noted"
  ]
}`;

// POST /api/estimate/from-scope - Generate line items from a text scope of work
// Enhanced with RAG context when userId is provided
export async function POST(request) {
  try {
    const { scope, apiKey, userId } = await request.json();

    if (!scope) {
      return Response.json({ error: 'Scope of work text is required' }, { status: 400 });
    }
    if (!apiKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 });
    }

    // ── Build enhanced context when userId is available ──────────────
    let ragContext = '';
    let catalogItems = [];
    let defaultMarkup = 25;

    if (userId) {
      try {
        // Dynamically import RAG helpers (they depend on OpenAI + pgvector)
        const { searchSimilarEstimates, getCatalogContext } = await import('../../../lib/rag.js');
        const sql = getSQL();

        // Run all three lookups in parallel
        const [similarEstimates, catalogText, userRows] = await Promise.all([
          searchSimilarEstimates(userId, scope, 3).catch(() => []),
          getCatalogContext(userId, 100).catch(() => ''),
          sql`SELECT default_markup_pct FROM users WHERE id = ${userId}`.catch(() => []),
        ]);

        // Extract default markup
        if (userRows.length > 0 && userRows[0].default_markup_pct != null) {
          defaultMarkup = parseFloat(userRows[0].default_markup_pct);
        }

        // Build few-shot examples from similar past estimates
        if (similarEstimates.length > 0) {
          const exampleParts = ['## Similar Past Estimates (use these as pricing references)\n'];
          for (const est of similarEstimates) {
            exampleParts.push(`### "${est.estimateName}" (${(est.similarity * 100).toFixed(0)}% similar)`);
            if (est.totalCost > 0) exampleParts.push(`Total Cost: $${est.totalCost.toFixed(2)} | Total Price: $${est.totalPrice.toFixed(2)} | Margin: ${est.marginPct}%`);
            if (est.content) {
              // Include a trimmed version of the estimate content as a few-shot example
              const trimmed = est.content.length > 2000 ? est.content.slice(0, 2000) + '\n...(truncated)' : est.content;
              exampleParts.push(trimmed);
            }
            exampleParts.push('');
          }
          ragContext += exampleParts.join('\n');
        }

        // Append catalog context
        if (catalogText) {
          ragContext += '\n' + catalogText;
          // Parse catalog items for post-processing matching
          try {
            const catRows = await sql`
              SELECT id, name, description, category, unit, unit_cost, markup_pct
              FROM catalog_items
              WHERE user_id = ${userId}
              ORDER BY category, name
            `;
            catalogItems = catRows;
          } catch {
            // Non-fatal: catalog matching just won't work
          }
        }

        ragContext += `\n\n## User Preferences\n- Default markup: ${defaultMarkup}%\n- Apply this markup to any items where you are unsure of the markup.\n`;
      } catch (ragError) {
        // RAG enhancement is best-effort; fall back to basic behavior
        console.error('RAG enhancement failed, falling back to basic mode:', ragError.message);
      }
    }

    // ── Build the full prompt ────────────────────────────────────────
    const enhancedInstructions = ragContext
      ? `\n\n---\n## Context from User's Account\nUse the following real data to match their pricing, use their catalog items where applicable, and apply their default markup.\n\n${ragContext}\n---\n\nIMPORTANT:\n- When a catalog item matches, use the catalog's unit_cost and markup_pct instead of guessing.\n- Set "catalog_match" to the exact catalog item name for matched items.\n- For items NOT in the catalog, use your best market-rate estimate and the user's default markup of ${defaultMarkup}%.`
      : '';

    const fullPrompt = `${SCOPE_PROMPT}${enhancedInstructions}\n\nScope of Work:\n${scope}`;

    // ── Call Claude ──────────────────────────────────────────────────
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: fullPrompt,
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // ── Parse JSON from response ─────────────────────────────────────
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [], error: 'Failed to parse AI response' };
    }

    // ── Auto-match items to catalog ──────────────────────────────────
    const items = (parsed.items || []).map(item => {
      let catalog_item_id = null;

      if (catalogItems.length > 0) {
        // First: try to match by the AI's catalog_match suggestion
        if (item.catalog_match) {
          const exactMatch = catalogItems.find(
            c => c.name.toLowerCase() === item.catalog_match.toLowerCase()
          );
          if (exactMatch) {
            catalog_item_id = exactMatch.id;
          }
        }

        // Second: fallback to fuzzy matching on description vs catalog name
        if (!catalog_item_id) {
          const descLower = item.description.toLowerCase();
          let bestScore = 0;
          let bestMatch = null;

          for (const cat of catalogItems) {
            const catNameLower = cat.name.toLowerCase();
            const score = computeSimilarity(descLower, catNameLower);
            if (score > bestScore && score >= 0.6) {
              bestScore = score;
              bestMatch = cat;
            }
          }

          if (bestMatch) {
            catalog_item_id = bestMatch.id;
            // Use catalog pricing when we have a strong match
            if (bestScore >= 0.75) {
              item.unit_cost = parseFloat(bestMatch.unit_cost) || item.unit_cost;
              item.markup_pct = parseFloat(bestMatch.markup_pct) || item.markup_pct;
              if (bestMatch.unit) item.unit = bestMatch.unit;
            }
          }
        }
      }

      return {
        ...item,
        catalog_item_id,
      };
    });

    return Response.json({
      items,
      project_type: parsed.project_type || 'General',
      assumptions: parsed.assumptions || [],
      usage: response.usage,
      rag_enhanced: !!ragContext,
    });
  } catch (error) {
    if (error.status === 401) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Compute a simple word-overlap similarity score between two strings.
 * Returns a value between 0 and 1.
 * This is lightweight enough to run synchronously on every item without
 * needing an external library.
 */
function computeSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  // Dice coefficient: 2 * |intersection| / (|A| + |B|)
  return (2 * overlap) / (wordsA.size + wordsB.size);
}
