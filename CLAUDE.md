# CLAUDE.md

## Project Overview

**Mr. Better Boss** is an AI chatbot assistant for JobTread users, built by Better Boss (a JobTread Certified Implementation Partner). It uses Claude Sonnet 4 with web search to provide guidance on JobTread implementation, estimates, workflows, automations, and construction industry best practices.

Users provide their own Anthropic API key (stored in browser localStorage). There is no backend secret management.

## Tech Stack

- **Framework**: Next.js 14.0.4 (App Router)
- **Language**: JavaScript (no TypeScript)
- **AI**: Claude Sonnet 4 via `@anthropic-ai/sdk` ^0.52.0
- **Runtime**: Edge runtime for API routes
- **Styling**: Inline JavaScript style objects (no CSS files, no CSS-in-JS library)
- **State**: React `useState`/`useRef` hooks + `localStorage` (no external state library)
- **Deployment target**: Vercel

## File Structure

```
/
├── page.js          # Main chat UI component (client-side, 'use client')
├── route.js         # API endpoint for /api/chat (POST, edge runtime)
├── layout.js        # Root layout with metadata
├── next.config.js   # Minimal config (reactStrictMode only)
├── package.json     # 4 dependencies total
└── README.md        # User-facing documentation
```

**Note:** The README references an `app/` directory structure (`app/api/chat/route.js`, `app/page.js`), but the actual files sit at the repository root. This is likely the intended Next.js App Router structure when deployed.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Run production server
```

There are no test, lint, or format commands configured.

## Architecture

### API Route (`route.js`)

- Exports `POST` handler and `runtime = 'edge'`
- Receives `{ messages, apiKey }` in JSON body
- Validates API key presence and format (`sk-ant-` prefix)
- Creates per-request `Anthropic` client with user-supplied key
- Calls Claude Sonnet 4 (`claude-sonnet-4-20250514`) with:
  - `SYSTEM_PROMPT` containing personality directives and `BETTER_BOSS_KNOWLEDGE`
  - `web_search` tool (type `web_search_20250305`, max 3 uses per request)
  - `max_tokens: 2048`
- Returns `{ content, usage }` on success, `{ error }` on failure
- Handles 401 (invalid key), 429 (rate limit), and generic errors

### Chat UI (`page.js`)

- Single `Home` component using React hooks
- **API Key Modal**: First-run flow; validates and tests key via `/api/chat`
- **Settings Modal**: Three tabs — Personality, Quick Actions, API
- **Chat**: Message list with auto-scroll, typing indicator animation
- **Quick Actions**: Configurable buttons (max 8) that send preset prompts
- **Message formatting**: Basic markdown (`**bold**`, `*italic*`, `` `code` ``, newlines)
- **Persistence**: `mrBetterBoss_apiKey` and `mrBetterBoss_settings` in localStorage

### Layout (`layout.js`)

- Sets page title, description, and favicon
- Wraps children in `<html>` and `<body>` tags

## Key Patterns and Conventions

### Styling

All styles are defined in a `styles` object at the bottom of `page.js`. Some style properties are functions that accept a boolean (e.g., `styles.message(isUser)`) to handle conditional styling. No external CSS files or libraries are used.

### Brand Colors

- Background: `#1a1a2e` (dark navy)
- Surface: `#25253d`
- Primary purple: `#5d47fa`
- Secondary purple: `#7a64ff`
- Text: `#fffdfd`
- Muted text: `#6b6b8a`
- Success green: `#10b981`
- Error red: `#ef4444`

### Error Handling

- Input validation on client (API key format) and server (key presence, format)
- HTTP status-based error differentiation (401, 429, 5xx)
- User-facing error messages rendered in chat as `⚠️` prefixed messages

### Security Considerations

- API keys are stored in browser `localStorage` (not ideal for production)
- No server-side secrets — user supplies their own API key per request
- API key validated to start with `sk-ant-` on both client and server
- `dangerouslySetInnerHTML` is used for message rendering with basic markdown formatting

## CI/CD

Two GitHub Actions workflows (`.github/workflows/`):

- `npm-publish.yml` — Publishes to npm on release; runs `npm test` (no tests exist)
- `npm-publish-github-packages.yml` — Publishes to GitHub Packages on release

Both use Node.js 20.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.0.4 | React framework, routing, SSR |
| `react` | 18.2.0 | UI library |
| `react-dom` | 18.2.0 | React DOM renderer |
| `@anthropic-ai/sdk` | ^0.52.0 | Anthropic Claude API client |

No devDependencies. No testing, linting, or formatting tools installed.

## Things to Know When Making Changes

- The knowledge base (`BETTER_BOSS_KNOWLEDGE`) and system prompt (`SYSTEM_PROMPT`) are constants in `route.js`. To change bot behavior or knowledge, edit these directly.
- Quick action defaults are in `DEFAULT_SETTINGS` at the top of `page.js`.
- The project has no tests, no linter, and no type checking. Validate changes manually by running the dev server.
- All UI is in a single `page.js` file. When adding features, follow the existing pattern of inline styles and hook-based state.
- The API route uses edge runtime — avoid Node.js-specific APIs (e.g., `fs`, `path`).
