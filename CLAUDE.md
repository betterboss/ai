# ai (mr-better-boss)

AI-powered estimating and business management app for contractors. Built with Next.js.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18
- **AI**: Anthropic Claude SDK
- **Database**: Neon (PostgreSQL)
- **PDF**: pdfjs-dist
- **Images**: Sharp

## Project Structure

```
app/
  page.js            # Landing page
  layout.js          # Root layout
  api/               # API routes
  catalog/           # Product catalog
  components/        # Shared React components
  contacts/          # Contact management
  dashboard/         # Main dashboard
  estimate/          # AI estimating
  invoices/          # Invoice management
  jobs/              # Job tracking
  lib/               # Utilities & shared logic
  setup/             # Onboarding
```

## Commands

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm start` — Start production server

## Deployment

- Vercel (betterboss-projects team)
- Node.js >=20.0.0

## Guidelines

- Use App Router conventions (server components by default)
- API routes in `app/api/`
- Claude SDK for AI features (estimating, analysis)
- Keep components in `app/components/`
