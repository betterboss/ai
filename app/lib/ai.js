import Anthropic from '@anthropic-ai/sdk';
import { getSQL } from './db';

export const runtime = 'nodejs';

/**
 * Get an authenticated Anthropic client for a user.
 * Looks up the user's anthropic_api_key from the DB first,
 * then falls back to the provided key (e.g. from request body).
 * Throws if no key is available.
 */
export async function getAIClient(userId, fallbackKey) {
  let apiKey = fallbackKey || null;

  if (userId) {
    try {
      const sql = getSQL();
      const rows = await sql`
        SELECT anthropic_api_key FROM users WHERE id = ${userId}
      `;
      if (rows.length > 0 && rows[0].anthropic_api_key) {
        apiKey = rows[0].anthropic_api_key;
      }
    } catch (err) {
      // If DB lookup fails, fall through to fallback key
      console.error('Failed to look up user API key:', err.message);
    }
  }

  if (!apiKey) {
    throw new Error(
      'No Anthropic API key available. Configure your key in Settings or provide one in the request.'
    );
  }

  return new Anthropic({ apiKey });
}

/**
 * Get user-specific context for AI system prompts.
 * Pulls company info, recent estimate history, and catalog category summary
 * so the AI has relevant background for generating estimates and answering questions.
 */
export async function getUserContext(userId) {
  if (!userId) return '';

  const sql = getSQL();
  const parts = [];

  try {
    // 1. Company info
    const users = await sql`
      SELECT company_name, default_markup_pct
      FROM users WHERE id = ${userId}
    `;
    if (users.length > 0) {
      const user = users[0];
      if (user.company_name) {
        parts.push(`## Company: ${user.company_name}`);
      }
      if (user.default_markup_pct) {
        parts.push(`Default markup: ${user.default_markup_pct}%`);
      }
    }

    // 2. Recent estimates (last 10) for pricing patterns
    const estimates = await sql`
      SELECT name, client_name, job_address, status,
             total_cost, total_price, margin_pct, created_at
      FROM estimates
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    if (estimates.length > 0) {
      parts.push('\n## Recent Estimates');
      for (const est of estimates) {
        const cost = parseFloat(est.total_cost) || 0;
        const price = parseFloat(est.total_price) || 0;
        const margin = parseFloat(est.margin_pct) || 0;
        const line = [
          `- "${est.name}"`,
          est.client_name ? `for ${est.client_name}` : null,
          est.status ? `(${est.status})` : null,
          cost > 0 ? `— Cost: $${cost.toLocaleString()}` : null,
          price > 0 ? `Price: $${price.toLocaleString()}` : null,
          margin > 0 ? `Margin: ${margin}%` : null,
        ]
          .filter(Boolean)
          .join(' ');
        parts.push(line);
      }
    }

    // 3. Catalog categories summary
    const categories = await sql`
      SELECT category, COUNT(*) as item_count,
             ROUND(AVG(unit_cost)::numeric, 2) as avg_cost
      FROM catalog_items
      WHERE user_id = ${userId}
      GROUP BY category
      ORDER BY category
    `;
    if (categories.length > 0) {
      parts.push('\n## Catalog Summary');
      for (const cat of categories) {
        parts.push(
          `- ${cat.category || 'Uncategorized'}: ${cat.item_count} items (avg cost: $${cat.avg_cost})`
        );
      }
    }
  } catch (err) {
    console.error('Failed to build user context:', err.message);
    // Return whatever we collected so far rather than failing entirely
  }

  return parts.join('\n');
}

/**
 * Build a construction-aware system prompt by combining a base prompt
 * with the user's specific context (company, catalog, recent work).
 */
export function buildSystemPrompt(basePrompt, userContext) {
  const contextBlock = userContext
    ? `\n\n---\n## User Context\nThe following is real data from this user's account. Use it to personalize your responses, match their pricing patterns, and reference their catalog when appropriate.\n\n${userContext}\n---`
    : '';

  return `${basePrompt}${contextBlock}

## General Construction Guidelines
- Always think in terms of cost categories: materials, labor, equipment, subcontractors, overhead
- Use standard construction units (sqft, lf, sy, each, hour, day, lump sum)
- Account for waste factors on materials (typically 5-15% depending on material)
- Consider regional pricing variations when the user provides a job address
- Markup and margin are different: markup is added on top of cost; margin is percentage of price
- When uncertain about local pricing, note assumptions and suggest the user verify with local suppliers`;
}
