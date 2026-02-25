-- Better Boss Platform — Neon Postgres Schema
-- Run this in the Neon SQL Editor or via psql to set up all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- EXISTING TABLES (original 6)
-- ============================================================================

-- Users / API config
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

-- Cost catalog (materials, labor rates, equipment, subs)
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                    -- 'material', 'labor', 'equipment', 'subcontractor'
  unit TEXT,                        -- 'sqft', 'lf', 'each', 'hour', etc.
  unit_cost DECIMAL(10,2),
  markup_pct DECIMAL(5,2) DEFAULT 0,
  supplier TEXT,
  jobtread_cost_code_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Estimates (the main entity)
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  job_address TEXT,
  status TEXT DEFAULT 'draft',      -- draft, sent, approved, rejected
  total_cost DECIMAL(12,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,
  margin_pct DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  jobtread_job_id TEXT,
  jobtread_estimate_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Estimate line items
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
  source TEXT DEFAULT 'manual',     -- 'manual', 'takeoff', 'catalog'
  catalog_item_id UUID REFERENCES catalog_items(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Takeoffs (PDF analysis results)
CREATE TABLE IF NOT EXISTS takeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  page_count INT,
  status TEXT DEFAULT 'pending',    -- pending, analyzing, complete, error
  raw_analysis JSONB,
  extracted_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote templates
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

-- ============================================================================
-- ALTER EXISTING TABLES
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- NEW TABLES — NextAuth
-- ============================================================================

-- NextAuth OAuth accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NextAuth sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NextAuth email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================================
-- NEW TABLES — Leads & CRM
-- ============================================================================

-- Lead capture
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT,
  raw_data JSONB,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  job_description TEXT,
  status TEXT DEFAULT 'new',
  jobtread_contact_id TEXT,
  jobtread_job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Sequences / Follow-up Automation
-- ============================================================================

-- Follow-up sequences
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Steps within sequences
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  delay_days INT DEFAULT 0,
  delay_hours INT DEFAULT 0,
  action_type TEXT NOT NULL,
  action_config JSONB,
  conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Active enrollments in a sequence
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID,
  job_id TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  current_step INT DEFAULT 0,
  status TEXT DEFAULT 'active',
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Execution logs for sequence steps
CREATE TABLE IF NOT EXISTS sequence_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  channel TEXT,
  content TEXT,
  subject TEXT,
  status TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Templates
-- ============================================================================

-- Email / SMS message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  channel TEXT,
  subject TEXT,
  body TEXT,
  variables JSONB,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Field Operations
-- ============================================================================

-- Job site daily logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT,
  job_name TEXT,
  log_date DATE NOT NULL,
  weather TEXT,
  crew_present TEXT[],
  narrative TEXT,
  photos TEXT[],
  ai_generated BOOLEAN DEFAULT false,
  jobtread_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Change orders linked to estimates
CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  reason TEXT,
  original_scope TEXT,
  new_scope TEXT,
  cost_impact DECIMAL(12,2) DEFAULT 0,
  price_impact DECIMAL(12,2) DEFAULT 0,
  customer_explanation TEXT,
  status TEXT DEFAULT 'draft',
  jobtread_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contract clause library
CREATE TABLE IF NOT EXISTS contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT,
  clause_text TEXT NOT NULL,
  when_to_use TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Dashboard & Analytics
-- ============================================================================

-- Cached dashboard analytics snapshots
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dashboard_type TEXT NOT NULL,
  data JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Voice & AI Agent
-- ============================================================================

-- Voice command logs
CREATE TABLE IF NOT EXISTS voice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audio_url TEXT,
  transcription TEXT,
  parsed_intent TEXT,
  parsed_params JSONB,
  execution_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent chat conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'web',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — Integrations
-- ============================================================================

-- External integrations configuration
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  config JSONB,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Integration sync log
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_id TEXT,
  destination_id TEXT,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- NEW TABLES — RAG / Embeddings (requires pgvector)
-- ============================================================================

-- Estimate embeddings for RAG retrieval
CREATE TABLE IF NOT EXISTS estimate_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  content_text TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES — Existing tables
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_user_id ON catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_takeoffs_estimate_id ON takeoffs(estimate_id);

-- ============================================================================
-- INDEXES — NextAuth tables
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_provider_account_id ON accounts(provider, provider_account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);

-- ============================================================================
-- INDEXES — Leads
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ============================================================================
-- INDEXES — Sequences & Enrollments
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_step_order ON sequence_steps(sequence_id, step_order);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_user_id ON sequence_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_lead_id ON sequence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_run_at ON sequence_enrollments(next_run_at);
CREATE INDEX IF NOT EXISTS idx_sequence_logs_enrollment_id ON sequence_logs(enrollment_id);

-- ============================================================================
-- INDEXES — Templates
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel);

-- ============================================================================
-- INDEXES — Field Operations
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_job_id ON daily_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_log_date ON daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_change_orders_estimate_id ON change_orders(estimate_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_user_id ON change_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_user_id ON contract_clauses(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_category ON contract_clauses(category);

-- ============================================================================
-- INDEXES — Dashboard & Analytics
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_user_id ON dashboard_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_type ON dashboard_snapshots(dashboard_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_generated_at ON dashboard_snapshots(generated_at);

-- ============================================================================
-- INDEXES — Voice & AI Agent
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_voice_logs_user_id ON voice_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_logs_created_at ON voice_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================================================
-- INDEXES — Integrations
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);
CREATE INDEX IF NOT EXISTS idx_sync_log_integration_id ON sync_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_entity_type ON sync_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log(created_at);

-- ============================================================================
-- INDEXES — RAG / Embeddings
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_estimate_embeddings_user_id ON estimate_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_embeddings_estimate_id ON estimate_embeddings(estimate_id);

-- HNSW index for fast approximate nearest-neighbor search on embeddings
CREATE INDEX IF NOT EXISTS idx_estimate_embeddings_vector ON estimate_embeddings
  USING hnsw (embedding vector_cosine_ops);
