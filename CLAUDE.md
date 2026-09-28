# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Direction l'Algérie Travel Lead Desk is a premium internal CRM for managing the full travel lead lifecycle — from web form or WhatsApp intake, through AI-assisted qualification and agency orchestration, to PDF quote delivery. The traveler never communicates directly with partner agencies; Direction l'Algérie is the sole interface.

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production (uses --webpack flag)
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:link      # Link to Supabase project (run once)
npm run db:push      # Push migrations to Supabase
```

No test suite is configured. Local Supabase requires Docker (`supabase start`); email preview available at http://127.0.0.1:54324.

## Tech Stack

- **Next.js 16** (App Router, RSC, force-dynamic) + **React 19** + **TypeScript 5**
- **Supabase** — Postgres + Auth + RLS + Storage
- **Tailwind CSS 4** with `@tailwindcss/postcss` and inline `@theme` tokens
- **OpenAI** — qualification, agency scoring, proposal comparison
- **WhatsApp Cloud API** (Meta) — inbound webhook + outbound messaging
- **Resend** — transactional email
- **@react-pdf/renderer** — PDF quote generation
- **Vercel** — hosting

## Architecture

### Authentication & Routing

`middleware.ts` (root) calls `updateSession()` to refresh Supabase cookies on every request. `src/app/page.tsx` redirects to `/dashboard` or `/login`. All dashboard routes are under `src/app/(dashboard)/` with a `force-dynamic` layout that enforces auth.

Supabase clients:
- `src/lib/supabase/server.ts` — RSC/Server Actions (anon key, RLS applies)
- `src/lib/supabase/client.ts` — browser client
- `src/lib/supabase/admin.ts` — service role (API routes only, never expose to client)

### Data Layer

All mutations go through **Server Actions** (`"use server"`) in `src/app/(dashboard)/leads/actions.ts`, `ai-actions.ts`, `quote-actions.ts`, `workflow-actions.ts`. These validate auth before calling Supabase.

RLS policies restrict row access by `auth.uid()`. The service role client bypasses RLS and is used only in `src/app/api/` routes.

### Lead Lifecycle

```
Intake (web form or WhatsApp) → new
  ↓ Referent assigned
Qualification (AI via OpenAI) → qualification
  ↓ AI scores agencies
Agency Assignment → agency_assignment
  ↓ Agencies invited (consultations table)
Co-Construction (optional iteration) → co_construction
  ↓ Quote built
Quote → quote
  ↓ Accepted or declined
won / lost / negotiation
```

**Back office v3 (since 2026-09-27)**: the operator screens (`/inbox`, `/leads`, `/leads/[id]`, `/dashboard`, `/agencies`) are driven by the **trame** the website sends with each project. They show 7 derived steps (À compléter → Reçu → Brief prêt → Envoyé aux agences → Proposition → Proposée → Clos) computed from `leads.status` without changing the enum, and track two 48 h clocks (first reply to the traveler, agency proposal after the brief). No schema change: extra data lives in existing JSON columns. Map of where everything is stored: `docs/REFONTE_V3.md`. Writes: `src/app/(dashboard)/leads/projet-actions.ts`; rules: `src/lib/bo3/`.

**Intake**: `POST /api/intake/route.ts` → `lib/intake-lead-insert.ts` → `buildLeadInsertFromIntake()` → insert with `submission_id` for idempotency.

**WhatsApp**: `POST /api/whatsapp/webhook/route.ts` (GET for challenge verification, POST for messages) → `lib/leads-whatsapp-inbound.ts` → find/create lead → trigger AI qualification.

**AI**: `src/lib/ai/agent.ts` wraps OpenAI. Prompts in `src/lib/ai/prompts/`. Server-only; never expose `OPENAI_API_KEY` to client. If absent, AI features degrade gracefully.

**PDF**: `GET /api/leads/[leadId]/quotes/[quoteId]/pdf/route.tsx` → `@react-pdf/renderer` → buffer → optional storage in `quote_pdfs` bucket. When `quotes.items` is the v3 object (`{ v: 3, … }`), the PDF is the "Proposition de voyage" of Direction l'Algérie with the partnership mention; otherwise the legacy table. PDF packages are listed in `next.config.ts` as `serverExternalPackages`.

**Traveler requalification page**: public, client-facing page `GET /q/[token]` (hosted on `app.directionlalgerie.com` alongside the desk) where the traveler completes qualification instead of replying to a long email. Operator generates a per-lead token from the cockpit (`generateTravelerLink` in `leads/actions.ts`); the page + `POST /api/q/[token]` use the **service role** (public, no session — `middleware.ts` skips `updateSession` on `/q/*`). Responses land on `leads.traveler_responses` (JSONB) and show read-only in the cockpit dossier. With `?champs=dates,groupe,budget,lieux` (v3), the page shows a short form limited to what the trame lacks, posted to `POST /api/q/[token]/champs`, which fills `ai_qualification_payload.trame_v3`. Validation/typing in `src/lib/traveler-requalification.ts`; option ids reuse `qualification-blocks-config.ts`. Env: `NEXT_PUBLIC_TRAVELER_BASE_URL`. Docs: `docs/SPEC_PAGE_VOYAGEUR_REQUALIFICATION.md`.

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Users with `role`: `admin` or `lead_referent` |
| `leads` | Travel inquiries (central table) |
| `agencies` | Partner agencies |
| `consultations` | Lead ↔ agency linkage, tracks responses |
| `quotes` | Pricing proposals with `workflow_status` |
| `quotes_workflow_items` | Line items for PDF |
| `lead_circuit_proposals` | AI-scored agency shortlists |
| `activities` | Audit trail per lead |

Lead status enum: `new → qualification → agency_assignment → co_construction → quote → negotiation → won/lost`

Migrations are in `supabase/migrations/` in chronological order. Run `npm run db:push` to apply.

### UI Structure

Dashboard pages render inside `Bo3Shell` (`src/components/bo3/shell.tsx`). The lead detail view (`src/app/(dashboard)/leads/[id]/page.tsx`) is the v3 project file (`src/components/bo3/fiche.tsx`): tabs Trame / Qualification, Brief & agences, Propositions & devis, Voyageur & messages. Screens not yet redesigned render in a `.legacy` wrapper. v3 styles come from `src/styles/bo3.css`, generated by `scripts/generer-bo3-css.mjs` and scoped to `.bo3` — do not edit it by hand.

**Design tokens** (defined in `src/styles/globals.css`):
- `--steel: #182b35` — primary accent
- `--panel: #ffffff`, `--panel-muted: #f4f7fa`
- Fonts: Cormorant Garamond (display/brand), Poppins (UI)

Layout breaks at `lg:` for sidebar + main; mobile nav via `DashboardMobileNav`.

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only (never NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o           # default

# Optional integrations
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_DA_CONTACT_EMAIL=
NEXT_PUBLIC_WHATSAPP_DA_NUMBER=

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=           # HMAC signature verification

ALLOWED_ORIGIN=                # CORS for /api/intake
INTAKE_SHARED_SECRET=          # Bearer token for /api/intake
CRON_SECRET=                   # protects /api/cron/keepalive (keeps Supabase awake)
TRAVELER_ACK_ENABLED=0         # 1 = automatic acknowledgment e-mail to the traveler (keep 0 until contact@ works again)
BO3_APERCU_LOCAL=              # 1 = preview without login, development only
```

See `.env.example` for full list.

## Key Docs

- `docs/PRD_TRAVEL_LEAD_DESK_V2.md` — canonical product vision
- `docs/PRODUCT_SPEC.md` — UX and business rules
- `docs/REFONTE_V3.md` — back office v3: derived steps, 48 h clocks, where each piece of data is stored
- `docs/USER_JOURNEYS.md` — operator flows, pipeline guards, conflict matrix (living doc: update with any lead/workflow/RLS change; see `CONTRIBUTING.md`)
- `docs/CODE_PATCHES_P0_FROM_PLAN.md` — archive note (P0 appliqué ; voir `USER_JOURNEYS.md`)
- `docs/IMPLEMENTATION_PENDING_V2.md` — known gaps between spec and current code (read before assuming feature completeness)
- `docs/RLS_PROD_CHECKLIST.md` — RLS security audit checklist
- `docs/DEPLOY_VERCEL.md` — deployment guide
- `CONTRIBUTING.md` — PR checklist (keep `USER_JOURNEYS.md` in sync)
