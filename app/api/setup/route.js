import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

// Load schema at module level (resolved at build-time for serverless)
let SCHEMA_SQL;
try {
  SCHEMA_SQL = readFileSync(
    join(process.cwd(), 'app', 'lib', 'schema.sql'),
    'utf-8'
  );
} catch {
  SCHEMA_SQL = null;
}

// Tables that exist in the original estimator
const CORE_TABLES = [
  'users', 'catalog_items', 'estimates', 'estimate_items',
  'takeoffs', 'quote_templates',
];

// Tables added by the full AI platform
const PLATFORM_TABLES = [
  'accounts', 'sessions', 'verification_tokens',
  'leads', 'sequences', 'sequence_steps', 'sequence_enrollments',
  'sequence_logs', 'message_templates', 'daily_logs', 'change_orders',
  'contract_clauses', 'dashboard_snapshots', 'voice_logs',
  'conversations', 'messages', 'integrations', 'sync_log',
];

// Depends on pgvector extension
const OPTIONAL_TABLES = ['estimate_embeddings'];

/**
 * Parse SQL file into individual executable statements.
 * Strips comment lines and splits on semicolons.
 */
function parseStatements(sql) {
  const lines = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return lines
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Check if a statement depends on the pgvector extension.
 */
function usesVector(stmt) {
  const lower = stmt.toLowerCase();
  return (
    lower.includes('vector(') ||
    lower.includes('vector_cosine_ops') ||
    (lower.includes('estimate_embeddings') && !lower.includes('information_schema'))
  );
}

// GET: Check database status with upgrade detection
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({
      status: 'no_database',
      message:
        'DATABASE_URL environment variable is not set. Add a Neon Postgres database to your Vercel project.',
    });
  }

  try {
    const sql = neon(url);
    const allCheck = [...CORE_TABLES, ...PLATFORM_TABLES, ...OPTIONAL_TABLES];

    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ANY(${allCheck})
    `;

    const found = new Set(tables.map((t) => t.table_name));
    const coreFound = CORE_TABLES.filter((t) => found.has(t));
    const platformFound = PLATFORM_TABLES.filter((t) => found.has(t));
    const hasCore = coreFound.length === CORE_TABLES.length;
    const hasPlatform = platformFound.length === PLATFORM_TABLES.length;
    const hasVector = OPTIONAL_TABLES.every((t) => found.has(t));

    let status;
    if (hasCore && hasPlatform) status = 'ready';
    else if (hasCore && !hasPlatform) status = 'needs_upgrade';
    else status = 'needs_setup';

    return Response.json({
      status,
      tables: [...found],
      core: { expected: CORE_TABLES.length, found: coreFound.length },
      platform: { expected: PLATFORM_TABLES.length, found: platformFound.length },
      vector: hasVector,
      message:
        status === 'ready'
          ? 'Database is fully configured'
          : status === 'needs_upgrade'
            ? 'Core tables exist. Platform tables need to be added.'
            : 'Database needs initial setup',
    });
  } catch (err) {
    return Response.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}

// POST: Run full schema setup with error tolerance
export async function POST() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json(
      { error: 'DATABASE_URL environment variable is not set.' },
      { status: 400 }
    );
  }

  if (!SCHEMA_SQL) {
    return Response.json(
      { error: 'Could not load schema.sql. Ensure app/lib/schema.sql exists.' },
      { status: 500 }
    );
  }

  try {
    const sql = neon(url);
    const statements = parseStatements(SCHEMA_SQL);

    const results = {
      total: statements.length,
      succeeded: 0,
      skipped: 0,
      failed: [],
    };

    let vectorAvailable = true;

    for (const stmt of statements) {
      // If vector extension failed, skip vector-dependent statements
      if (!vectorAvailable && usesVector(stmt)) {
        results.skipped++;
        continue;
      }

      try {
        await sql(stmt);
        results.succeeded++;
      } catch (err) {
        // pgvector extension not available — skip gracefully
        if (
          stmt.toLowerCase().includes('create extension') &&
          stmt.toLowerCase().includes('vector')
        ) {
          vectorAvailable = false;
          results.skipped++;
          continue;
        }

        // Log but continue for other errors
        results.failed.push({
          statement: stmt.slice(0, 150),
          error: err.message,
        });
      }
    }

    return Response.json({
      success: results.failed.length === 0,
      message: `Schema applied: ${results.succeeded} succeeded, ${results.skipped} skipped, ${results.failed.length} failed`,
      ...results,
      vectorEnabled: vectorAvailable,
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to run schema: ' + err.message },
      { status: 500 }
    );
  }
}
