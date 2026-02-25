import OpenAI from 'openai';
import { getSQL } from './db';

export const runtime = 'nodejs';

// OpenAI embedding model config
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Get an OpenAI client using the OPENAI_API_KEY environment variable.
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing OPENAI_API_KEY environment variable. Add it to your Vercel project settings.'
    );
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate an embedding vector from text using OpenAI's text-embedding-3-small model.
 * Returns a float array of 1536 dimensions.
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  // Truncate to ~8000 tokens worth of text (~32k chars) to stay within model limits
  const truncated = text.slice(0, 32000);

  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Build a text representation of an estimate suitable for embedding.
 * Combines the estimate metadata with all line items into a single searchable string.
 */
function buildEstimateText(estimate, items) {
  const parts = [];

  // Estimate header
  parts.push(`Estimate: ${estimate.name}`);
  if (estimate.client_name) parts.push(`Client: ${estimate.client_name}`);
  if (estimate.job_address) parts.push(`Address: ${estimate.job_address}`);
  if (estimate.notes) parts.push(`Notes: ${estimate.notes}`);

  const totalCost = parseFloat(estimate.total_cost) || 0;
  const totalPrice = parseFloat(estimate.total_price) || 0;
  const marginPct = parseFloat(estimate.margin_pct) || 0;

  if (totalCost > 0) parts.push(`Total Cost: $${totalCost.toFixed(2)}`);
  if (totalPrice > 0) parts.push(`Total Price: $${totalPrice.toFixed(2)}`);
  if (marginPct > 0) parts.push(`Margin: ${marginPct}%`);
  if (estimate.status) parts.push(`Status: ${estimate.status}`);

  // Line items grouped by category
  if (items && items.length > 0) {
    const grouped = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    parts.push('\nLine Items:');
    for (const [category, catItems] of Object.entries(grouped)) {
      parts.push(`\n[${category}]`);
      for (const item of catItems) {
        const qty = parseFloat(item.quantity) || 0;
        const unitCost = parseFloat(item.unit_cost) || 0;
        const totalItemCost = parseFloat(item.total_cost) || 0;
        const line = `- ${item.description}: ${qty} ${item.unit || 'each'} @ $${unitCost.toFixed(2)}/${item.unit || 'each'} = $${totalItemCost.toFixed(2)}`;
        parts.push(line);
      }
    }
  }

  return parts.join('\n');
}

/**
 * Index an estimate into the RAG system.
 * Loads the estimate and its items from the DB, builds a text representation,
 * generates an embedding, and stores it in the estimate_embeddings table.
 *
 * The estimate_embeddings table must exist with pgvector enabled:
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE estimate_embeddings (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id UUID REFERENCES users(id),
 *     estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
 *     content TEXT NOT NULL,
 *     embedding vector(1536),
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *   CREATE INDEX ON estimate_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 */
export async function indexEstimate(userId, estimateId) {
  const sql = getSQL();

  // 1. Load estimate
  const estimates = await sql`
    SELECT id, name, client_name, job_address, status,
           total_cost, total_price, margin_pct, notes
    FROM estimates
    WHERE id = ${estimateId}
  `;
  if (estimates.length === 0) {
    throw new Error(`Estimate ${estimateId} not found`);
  }
  const estimate = estimates[0];

  // 2. Load line items
  const items = await sql`
    SELECT category, description, quantity, unit, unit_cost,
           markup_pct, total_cost, total_price, source
    FROM estimate_items
    WHERE estimate_id = ${estimateId}
    ORDER BY sort_order
  `;

  // 3. Build text representation
  const content = buildEstimateText(estimate, items);

  // 4. Generate embedding
  const embedding = await generateEmbedding(content);
  const embeddingStr = `[${embedding.join(',')}]`;

  // 5. Upsert into estimate_embeddings (replace if exists)
  await sql`
    DELETE FROM estimate_embeddings
    WHERE estimate_id = ${estimateId}
  `;

  await sql`
    INSERT INTO estimate_embeddings (user_id, estimate_id, content, embedding)
    VALUES (${userId}, ${estimateId}, ${content}, ${embeddingStr}::vector)
  `;

  return { estimateId, contentLength: content.length, itemCount: items.length };
}

/**
 * Search for similar past estimates using pgvector cosine similarity.
 * Returns the top N matches with their estimate metadata and similarity score.
 */
export async function searchSimilarEstimates(userId, queryText, limit = 5) {
  if (!queryText || queryText.trim().length === 0) {
    return [];
  }

  // 1. Generate embedding for the query text
  const embedding = await generateEmbedding(queryText);
  const embeddingStr = `[${embedding.join(',')}]`;

  // 2. Cosine similarity search scoped to this user's estimates
  const sql = getSQL();
  const results = await sql`
    SELECT
      ee.estimate_id,
      ee.content,
      1 - (ee.embedding <=> ${embeddingStr}::vector) AS similarity,
      e.name AS estimate_name,
      e.client_name,
      e.job_address,
      e.status,
      e.total_cost,
      e.total_price,
      e.margin_pct,
      e.created_at
    FROM estimate_embeddings ee
    JOIN estimates e ON e.id = ee.estimate_id
    WHERE ee.user_id = ${userId}
    ORDER BY ee.embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `;

  return results.map((row) => ({
    estimateId: row.estimate_id,
    estimateName: row.estimate_name,
    clientName: row.client_name,
    jobAddress: row.job_address,
    status: row.status,
    totalCost: parseFloat(row.total_cost) || 0,
    totalPrice: parseFloat(row.total_price) || 0,
    marginPct: parseFloat(row.margin_pct) || 0,
    similarity: parseFloat(row.similarity) || 0,
    content: row.content,
    createdAt: row.created_at,
  }));
}

/**
 * Load the user's catalog items grouped by category, formatted as
 * a text string suitable for injection into AI prompts.
 */
export async function getCatalogContext(userId, limit = 100) {
  if (!userId) return '';

  const sql = getSQL();

  const items = await sql`
    SELECT name, description, category, unit, unit_cost, markup_pct, supplier
    FROM catalog_items
    WHERE user_id = ${userId}
    ORDER BY category, name
    LIMIT ${limit}
  `;

  if (items.length === 0) {
    return 'No catalog items found. The user has not set up their cost catalog yet.';
  }

  // Group by category
  const grouped = {};
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const parts = ['## User Cost Catalog'];

  for (const [category, catItems] of Object.entries(grouped)) {
    parts.push(`\n### ${category} (${catItems.length} items)`);
    for (const item of catItems) {
      const cost = parseFloat(item.unit_cost) || 0;
      const markup = parseFloat(item.markup_pct) || 0;
      let line = `- ${item.name}`;
      if (item.description) line += ` — ${item.description}`;
      line += `: $${cost.toFixed(2)}/${item.unit || 'each'}`;
      if (markup > 0) line += ` (${markup}% markup)`;
      if (item.supplier) line += ` [${item.supplier}]`;
      parts.push(line);
    }
  }

  parts.push(
    `\nTotal catalog items shown: ${items.length}${items.length >= limit ? ' (truncated)' : ''}`
  );

  return parts.join('\n');
}
