-- AI Estimating App — Neon Postgres Schema
-- Run this in the Neon SQL Editor or via psql to set up all tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_user_id ON catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_takeoffs_estimate_id ON takeoffs(estimate_id);
