import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  anthropic_api_key TEXT,
  jobtread_grant_key TEXT,
  company_name TEXT,
  company_logo_url TEXT,
  default_markup_pct DECIMAL(5,2) DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT,
  unit_cost DECIMAL(10,2),
  markup_pct DECIMAL(5,2) DEFAULT 0,
  supplier TEXT,
  jobtread_cost_code_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  job_address TEXT,
  status TEXT DEFAULT 'draft',
  total_cost DECIMAL(12,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,
  margin_pct DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  jobtread_job_id TEXT,
  jobtread_estimate_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  unit_cost DECIMAL(10,2),
  markup_pct DECIMAL(5,2) DEFAULT 0,
  total_cost DECIMAL(12,2),
  total_price DECIMAL(12,2),
  source TEXT DEFAULT 'manual',
  catalog_item_id UUID REFERENCES catalog_items(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS takeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  page_count INT,
  status TEXT DEFAULT 'pending',
  raw_analysis JSONB,
  extracted_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_user_id ON catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_takeoffs_estimate_id ON takeoffs(estimate_id);
`;

// GET: Check database status
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({
      status: 'no_database',
      message: 'DATABASE_URL environment variable is not set. Add a Neon Postgres database to your Vercel project.',
    });
  }

  try {
    const sql = neon(url);
    // Check if tables exist
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('estimates', 'estimate_items', 'catalog_items', 'takeoffs', 'users')
    `;
    const tableNames = tables.map(t => t.table_name);
    const allExist = ['estimates', 'estimate_items', 'catalog_items', 'takeoffs'].every(t => tableNames.includes(t));

    return Response.json({
      status: allExist ? 'ready' : 'needs_setup',
      tables: tableNames,
      message: allExist ? 'Database is ready' : 'Database needs table setup',
    });
  } catch (err) {
    return Response.json({
      status: 'error',
      message: err.message,
    }, { status: 500 });
  }
}

// POST: Run database setup
export async function POST() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return Response.json({
      error: 'DATABASE_URL environment variable is not set.',
    }, { status: 400 });
  }

  try {
    const sql = neon(url);

    // Run each statement separately since neon() doesn't support multi-statement
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0);

    for (const stmt of statements) {
      await sql(stmt);
    }

    return Response.json({
      success: true,
      message: 'Database tables created successfully',
    });
  } catch (err) {
    return Response.json({
      error: 'Failed to create tables: ' + err.message,
    }, { status: 500 });
  }
}
