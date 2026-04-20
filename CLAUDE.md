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

**Intake**: `POST /api/intake/route.ts` → `lib/intake-lead-insert.ts` → `buildLeadInsertFromIntake()` → insert with `submission_id` for idempotency.

**WhatsApp**: `POST /api/whatsapp/webhook/route.ts` (GET for challenge verification, POST for messages) → `lib/leads-whatsapp-inbound.ts` → find/create lead → trigger AI qualification.

**AI**: `src/lib/ai/agent.ts` wraps OpenAI. Prompts in `src/lib/ai/prompts/`. Server-only; never expose `OPENAI_API_KEY` to client. If absent, AI features degrade gracefully.

**PDF**: `GET /api/leads/[leadId]/quotes/[quoteId]/pdf/route.tsx` → `@react-pdf/renderer` → buffer → optional storage in `quote_pdfs` bucket. PDF packages are listed in `next.config.ts` as `serverExternalPackages`.

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

The lead detail view (`src/app/(dashboard)/leads/[id]/page.tsx`) uses a cockpit shell (`src/components/leads/lead-cockpit-shell.tsx`) with tabbed panels: dossier, AI ops, co-construction, quotes, pipeline.

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
```

See `.env.example` for full list.

## Key Docs

- `docs/PRD_TRAVEL_LEAD_DESK_V2.md` — canonical product vision
- `docs/PRODUCT_SPEC.md` — UX and business rules
- `docs/USER_JOURNEYS.md` — operator flows, pipeline guards, conflict matrix (living doc: update with any lead/workflow/RLS change; see `CONTRIBUTING.md`)
- `docs/CODE_PATCHES_P0_FROM_PLAN.md` — archive note (P0 appliqué ; voir `USER_JOURNEYS.md`)
- `docs/IMPLEMENTATION_PENDING_V2.md` — known gaps between spec and current code (read before assuming feature completeness)
- `docs/RLS_PROD_CHECKLIST.md` — RLS security audit checklist
- `docs/DEPLOY_VERCEL.md` — deployment guide
- `CONTRIBUTING.md` — PR checklist (keep `USER_JOURNEYS.md` in sync)
