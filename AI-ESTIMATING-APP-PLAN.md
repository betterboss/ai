# AI Estimating, Quoting & Takeoff App - Implementation Plan

> **Better Boss** | Built by Nick Peret | JobTread Certified Implementation Partner
>
> This plan describes a new AI-powered estimating application that connects to JobTread.
> It is designed to be built alongside (not replace) the existing Mr. Better Boss chat app and Chrome extension.

---

## The Problem

Contractors using JobTread spend **45+ minutes per estimate**. Blueprint takeoffs are manual, error-prone, and slow. Quoting is disconnected from the data in JobTread. Better Boss already helps with implementation — this tool automates the estimating workflow itself.

## The Solution

An AI-powered web application that:
1. **Accepts PDF blueprint uploads** and analyzes them with Claude Vision
2. **Extracts material quantities and measurements** (takeoffs) automatically
3. **Applies cost data** from a reusable catalog to generate estimates
4. **Creates professional quotes/proposals** ready to send
5. **Auto-syncs estimates into JobTread** via the Pave API — no manual re-entry

**Target**: 45-minute estimates → under 10 minutes.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW ESTIMATING APP                        │
│                                                             │
│  /estimate              - Dashboard (all estimates)         │
│  /estimate/new          - Create new estimate               │
│  /estimate/[id]         - Estimate editor + takeoff         │
│  /estimate/[id]/quote   - Professional quote view           │
│  /catalog               - Cost catalog manager              │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │      API Routes        │
              │                        │
              │  /api/takeoff/analyze  │ ← Claude Vision (PDF → quantities)
              │  /api/estimate/*       │ ← Estimate CRUD
              │  /api/estimate/sync    │ ← Push to JobTread
              │  /api/quote/generate   │ ← AI quote generation
              │  /api/catalog/*        │ ← Cost catalog management
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  Database (Neon)       │ ← Serverless Postgres
              │  Estimates, line items │
              │  Cost catalog, takeoffs│
              │  Quote templates       │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  JobTread Pave API     │ ← Existing grant key auth
              │  POST /pave            │    Creates estimates, syncs
              │                        │    cost codes, contacts, jobs
              └────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Framework** | Next.js 14 (App Router) | Already in use, same stack |
| **Database** | Neon (Serverless Postgres) | Serverless, auto-scaling, native Vercel integration |
| **AI** | Claude Vision + Claude text | Already integrated via @anthropic-ai/sdk |
| **JobTread API** | Pave Query Language | Already proven in the Chrome extension |
| **PDF Processing** | pdfjs-dist + sharp | Convert PDF pages to images for Claude Vision |
| **Deployment** | Vercel + GitHub | CI/CD from GitHub, deployed on Vercel |

---

## Database Schema

### `users` - API config and company info
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  anthropic_api_key TEXT,           -- encrypted
  jobtread_grant_key TEXT,          -- encrypted
  company_name TEXT,
  company_logo_url TEXT,
  default_markup_pct DECIMAL(5,2) DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `catalog_items` - Reusable cost catalog
```sql
CREATE TABLE catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                    -- 'material', 'labor', 'equipment', 'subcontractor'
  unit TEXT,                        -- 'sqft', 'lf', 'each', 'hour', etc.
  unit_cost DECIMAL(10,2),
  markup_pct DECIMAL(5,2) DEFAULT 0,
  supplier TEXT,
  jobtread_cost_code_id TEXT,       -- maps to JobTread cost code
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `estimates` - The main entity
```sql
CREATE TABLE estimates (
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
  jobtread_job_id TEXT,             -- linked JobTread job
  jobtread_estimate_id TEXT,        -- linked JobTread customer order
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### `estimate_items` - Line items on an estimate
```sql
CREATE TABLE estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  category TEXT,                    -- cost group name
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
```

### `takeoffs` - PDF analysis results
```sql
CREATE TABLE takeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,                    -- File storage URL
  page_count INT,
  status TEXT DEFAULT 'pending',    -- pending, analyzing, complete, error
  raw_analysis JSONB,               -- full Claude Vision response
  extracted_items JSONB,            -- parsed quantities
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `quote_templates` - Reusable proposal templates
```sql
CREATE TABLE quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Core Features & API Routes

### Feature 1: PDF Takeoff Analysis

**Route**: `POST /api/takeoff/analyze`

**How it works**:
1. User uploads a PDF blueprint
2. Server converts each page to an image using `pdfjs-dist` + `sharp`
3. Each page image is sent to Claude Vision with a structured extraction prompt
4. Claude returns quantities in structured JSON
5. Results saved to `takeoffs` table and populated as line items

**Claude Vision Prompt**:
```
You are a construction takeoff specialist. Analyze this blueprint page and extract ALL measurable quantities.

Extract the following categories:

1. ROOMS: Each room with dimensions (L x W), area in sqft, ceiling height if shown
2. LINEAR MEASUREMENTS: Walls, trim, baseboards, countertops, railings (in linear feet)
3. AREA MEASUREMENTS: Flooring, paint, tile, roofing, siding (in sqft)
4. COUNTS: Doors, windows, outlets, switches, fixtures, appliances, cabinets
5. PLUMBING: Fixtures (sinks, toilets, showers), pipe runs, drains
6. ELECTRICAL: Panels, circuits, outlets, switches, light fixtures, fans
7. STRUCTURAL: Beams, columns, footings with dimensions

Look for:
- Scale indicators to calculate real-world measurements
- Dimension lines and callouts
- Material specifications noted on the drawings
- Room labels and annotations

Return as JSON:
{
  "page_description": "Brief description of what this page shows",
  "scale": "Scale if identifiable (e.g., 1/4 inch = 1 foot)",
  "rooms": [
    { "name": "Kitchen", "length_ft": 15, "width_ft": 12, "area_sqft": 180, "ceiling_height_ft": 9 }
  ],
  "items": [
    { "category": "Flooring", "description": "Kitchen tile floor", "quantity": 180, "unit": "sqft", "notes": "Porcelain tile specified" },
    { "category": "Electrical", "description": "Duplex outlets", "quantity": 8, "unit": "each", "notes": "Per kitchen layout" }
  ]
}

Be thorough. Count every element. If you can calculate an area or length from dimensions shown, do it. If a quantity is unclear, provide your best estimate with a note.
```

### Feature 2: Estimate Editor

**Route**: `/app/estimate/[id]/page.js`

**UI Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│  ← Estimates    Kitchen Remodel - Smith Residence    [Save]  │
│  Status: Draft  │  $24,500 price  │  32% margin              │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│  📋 JOB INFO    │  LINE ITEMS                               │
│  ─────────────  │  ┌────────┬────┬─────┬───────┬─────────┐ │
│  Client: Smith  │  │ Item   │Qty │Unit │ Cost  │  Price  │ │
│  Address: 123.. │  ├────────┼────┼─────┼───────┼─────────┤ │
│  Phone: 555-... │  │Drywall │480 │sqft │$1.50  │ $1,080  │ │
│                  │  │Tile    │120 │sqft │$8.00  │ $1,440  │ │
│  📄 TAKEOFFS    │  │Vanity  │ 2  │each │$450   │ $1,350  │ │
│  ─────────────  │  │Paint   │960 │sqft │$0.85  │ $1,224  │ │
│  [Upload PDF]   │  │Plumber │ 16 │hrs  │$95    │ $2,280  │ │
│  ☑ floor1.pdf  │  │Electric│ 12 │hrs  │$85    │ $1,530  │ │
│  ☑ floor2.pdf  │  └────────┴────┴─────┴───────┴─────────┘ │
│  ○ analyzing... │                                           │
│                  │  [+ Add Item] [📚 Catalog] [🤖 AI Fill]  │
│  🔧 ACTIONS     │                                           │
│  ─────────────  │  ──────────────────────────────────────── │
│  [Sync to JT]   │  SUMMARY                                  │
│  [Generate Quote]│  Materials .............. $12,400         │
│  [Duplicate]     │  Labor .................. $8,200          │
│  [Delete]        │  Markup (25%) ........... $3,900          │
│                  │  ──────────────────────────                │
│                  │  TOTAL .................. $24,500         │
└──────────────────┴───────────────────────────────────────────┘
```

**Key interactions**:
- Click any cell to edit inline (quantity, cost, markup)
- Upload PDF → triggers takeoff analysis → auto-populates line items
- "AI Fill" → Claude suggests missing items based on project type
- "Catalog" → search your saved materials/labor rates
- "Sync to JT" → creates the estimate in JobTread
- Totals auto-recalculate on every change

### Feature 3: JobTread Sync

**Route**: `POST /api/estimate/[id]/sync`

Uses the **Pave Query Language** (same pattern as `extension/background.js:316-392`):

```javascript
// Step 1: Find or create the job in JobTread
const jobResult = await paveQuery(grantKey, {
  createJob: {
    $: {
      input: {
        name: estimate.name,
        organizationId: orgId,
        locationInput: { address: estimate.job_address }
      }
    },
    id: {},
    number: {}
  }
});

// Step 2: Create customer order (estimate) with line items
const estimateResult = await paveQuery(grantKey, {
  createDocument: {
    $: {
      input: {
        jobId: jobResult.createJob.id,
        type: 'customerOrder',
        name: estimate.name,
        contactId: contactId,
        lineItems: estimate.items.map(item => ({
          name: item.description,
          quantity: item.quantity,
          unitCost: item.unit_cost,
          unitPrice: item.total_price / item.quantity,
          costCodeId: item.jobtread_cost_code_id
        }))
      }
    },
    id: {},
    number: {},
    price: {},
    cost: {}
  }
});
```

### Feature 4: Quote/Proposal Generation

**Route**: `/app/estimate/[id]/quote/page.js`

A clean, professional, printable proposal page:
- Company logo + branding
- Client info + job address
- Line items grouped by category (Materials, Labor, Equipment, etc.)
- Subtotals per category
- Total price
- Terms & conditions
- Valid-until date
- Print / Download PDF / Share link buttons
- Optional: Claude AI writes a personalized cover letter based on the scope

### Feature 5: Cost Catalog Manager

**Route**: `/app/catalog/page.js`

- Add/edit/delete catalog items (materials, labor, equipment, subs)
- Categories for organization
- Import from CSV/Excel (reusing patterns from existing `index.html`)
- Sync with JobTread cost codes: `GET cost codes via Pave → map to catalog items`
- Search and filter
- Set default markup per category

---

## AI Enhancement Features (Phase 3)

### Scope-to-Estimate
**Route**: `POST /api/estimate/from-scope`

User pastes a text scope of work → Claude extracts line items:
```
"Remodel master bathroom. Remove existing tub, install walk-in shower
with frameless glass door. New vanity with double sinks. Retile floor
and shower walls with 12x24 porcelain. New lighting and exhaust fan."
```
→ Claude generates 15-20 line items with suggested quantities.

### Smart Cost Suggestions
When takeoff generates quantities but no costs, Claude suggests pricing based on:
- User's catalog history (similar past items)
- Regional pricing context
- Material specifications from the blueprints

### Estimate Review AI
Before syncing to JobTread, Claude reviews for:
- **Missing items**: "You have tile but no grout, thinset, or backer board"
- **Margin warnings**: Items below 15% margin flagged
- **Scope gaps**: Common items for this project type that are missing
- **Math errors**: Quantities that seem off (e.g., 10 sqft of flooring for a 200 sqft room)

---

## Chrome Extension Integration (Phase 4)

Enhance the existing extension (`extension/background.js`) with:

1. **"Create Estimate" skill** — when on a JobTread job page, detect the job ID and open the estimating app pre-filled with client/job info
2. **Deep links** — extension links directly to `/estimate/[id]` in the web app
3. **Skill tag**: `[SKILL:CREATE_ESTIMATE:jobId]` — opens new estimate for that job

---

## New Dependencies

```json
{
  "@neondatabase/serverless": "^0.10.x",
  "pdfjs-dist": "^4.x",
  "sharp": "^0.33.x"
}
```

| Package | Purpose |
|---------|---------|
| `@neondatabase/serverless` | Neon serverless Postgres driver (Edge-compatible) |
| `pdfjs-dist` | PDF parsing and page rendering |
| `sharp` | Image processing for PDF → PNG conversion |

## Environment Variables (New)

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> **Tip**: Connect Neon to your Vercel project via the Neon integration — `DATABASE_URL` is auto-injected into all deployments.

---

## File Map (All New Files — Nothing Existing Is Modified)

```
/app
├── lib/
│   ├── db.js                        ← Neon serverless client
│   ├── jobtread.js                  ← Server-side Pave API client
│   └── pdf.js                       ← PDF-to-image conversion
├── api/
│   ├── takeoff/
│   │   └── analyze/route.js         ← Claude Vision blueprint analysis
│   ├── estimate/
│   │   ├── route.js                 ← List/create estimates
│   │   ├── from-scope/route.js      ← NLP scope-to-estimate
│   │   └── [id]/
│   │       ├── route.js             ← Get/update/delete estimate
│   │       ├── items/route.js       ← Line item CRUD
│   │       └── sync/route.js        ← Push to JobTread
│   ├── catalog/
│   │   ├── route.js                 ← Catalog CRUD
│   │   ├── import/route.js          ← CSV/Excel import
│   │   └── sync/route.js            ← Sync from JobTread cost codes
│   └── quote/
│       └── generate/route.js        ← AI quote cover letter
├── estimate/
│   ├── page.js                      ← Estimate dashboard
│   ├── new/page.js                  ← New estimate form
│   └── [id]/
│       ├── page.js                  ← Estimate editor
│       └── quote/page.js            ← Quote/proposal view
├── catalog/
│   └── page.js                      ← Cost catalog manager
└── components/
    ├── EstimateTable.js             ← Editable line items table
    ├── TakeoffUploader.js           ← PDF upload + analysis UI
    ├── CatalogPicker.js             ← Search & add from catalog
    ├── QuoteRenderer.js             ← Printable quote layout
    └── Nav.js                       ← Navigation header
```

**Total: 20 new files. Zero existing files modified.**

---

## Implementation Order

| Step | What | Depends On |
|------|------|------------|
| 1 | Set up Neon project + run schema SQL | Nothing |
| 2 | Create `/app/lib/db.js` (Neon client) | Step 1 |
| 3 | Create `/app/lib/jobtread.js` (port Pave API from extension) | Nothing |
| 4 | Build estimate CRUD APIs (`/api/estimate/*`) | Steps 1-2 |
| 5 | Build estimate dashboard UI (`/estimate/page.js`) | Step 4 |
| 6 | Build estimate editor UI (`/estimate/[id]/page.js`) | Step 4 |
| 7 | Build cost catalog API + UI (`/api/catalog/*`, `/catalog/page.js`) | Steps 1-2 |
| 8 | Build PDF takeoff analysis (`/app/lib/pdf.js`, `/api/takeoff/analyze`) | Steps 1-2 |
| 9 | Build takeoff uploader component + wire to editor | Steps 6, 8 |
| 10 | Build JobTread sync API (`/api/estimate/[id]/sync`) | Steps 3, 4 |
| 11 | Build quote/proposal view (`/estimate/[id]/quote`) | Step 6 |
| 12 | Build scope-to-estimate AI (`/api/estimate/from-scope`) | Step 4 |
| 13 | Build estimate review AI (pre-sync check) | Steps 4, 10 |
| 14 | Chrome extension integration | Steps 4, 10 |

---

## Verification Checklist

- [ ] Database schema deployed to Neon
- [ ] Can create, edit, delete estimates via UI
- [ ] Can manage cost catalog (add, edit, import CSV)
- [ ] PDF upload → Claude Vision extracts quantities → populates line items
- [ ] Line items calculate costs correctly with markup
- [ ] "Sync to JT" creates a customer order in JobTread with all line items
- [ ] Quote view renders cleanly and prints/exports
- [ ] Scope-to-estimate generates reasonable line items from text
- [ ] AI review catches missing items before sync
- [ ] End-to-end: Upload PDF → takeoff → cost → sync to JobTread → verify in JT app
