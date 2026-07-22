# Page voyageur de requalification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page publique `app.directionlalgerie.com/q/<token>` où le voyageur complète la qualification de son lead, avec génération du lien et lecture des réponses dans le cockpit.

**Architecture:** 4 colonnes sur `leads` + route publique Next.js App Router (`/q/[token]`, RSC + formulaire client) + API `GET/POST /api/q/[token]` en service role (pattern `/api/intake`). Les pages voyageur cohabitent avec le desk sur `app.directionlalgerie.com` (déjà connecté à Vercel) : hors de `(dashboard)`, elles sont publiques par construction ; le middleware court-circuite simplement `updateSession` sur `/q/*`. Aucun changement à la mécanique `qualification_blocks` existante.

**Tech Stack:** Next.js 16 (App Router, params async), React 19, TypeScript 5, Supabase (service role), Tailwind CSS 4, Resend (optionnel).

**Spec:** [`docs/SPEC_PAGE_VOYAGEUR_REQUALIFICATION.md`](./SPEC_PAGE_VOYAGEUR_REQUALIFICATION.md) — la source de vérité fonctionnelle.

## Global Constraints

- Pas de suite de tests dans ce repo (`CLAUDE.md` : « No test suite is configured ») → chaque tâche se vérifie par `npm run build`, `npm run lint` et les commandes/parcours indiqués. Ne pas introduire de framework de test.
- La clé service role ne doit jamais atteindre le client : `createServiceRoleClient()` uniquement dans RSC/route handlers (`src/lib/supabase/admin.ts`).
- La page publique n'affiche jamais `email` ni `phone` du lead.
- Ne jamais mentionner « agences partenaires » ni « IA » dans les textes voyageur (doctrine produit).
- Ids d'options : réutiliser ceux de `src/components/leads/qualification/qualification-blocks-config.ts` (ne pas inventer de doublons).
- Textes libres bornés à 500 caractères serveur ; enums en whitelist ; payload non conforme → 422.
- Tokens design : `--steel #182b35`, Cormorant Garamond (display), Poppins (UI) — définis dans `src/app/globals.css`. Réf. `docs/DESIGN_SYSTEM.md`.
- Commits : un par tâche, messages `feat:`/`docs:` en français, sur la branche `feat/traveler-requalification-page`.
- Next 16 : `params` des pages/routes dynamiques est un `Promise` → toujours `const { token } = await params;`.

---

## Phase A — Code (exécutable en local, sans toucher à la prod)

### Task 1: Migration SQL + types row + env example

**Files:**
- Create: `supabase/migrations/20260722120000_traveler_requalification.sql`
- Modify: `src/lib/supabase-lead-row.ts` (interface `SupabaseLeadRow`)
- Modify: `.env.example`

**Interfaces:**
- Produces: colonnes `public_token`, `public_token_expires_at`, `traveler_responses`, `traveler_responses_submitted_at` sur `public.leads` ; mêmes champs dans `SupabaseLeadRow`.

- [ ] **Step 1: Écrire la migration**

```sql
-- Page voyageur de requalification (spec: docs/SPEC_PAGE_VOYAGEUR_REQUALIFICATION.md)
alter table public.leads
  add column if not exists public_token uuid,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists traveler_responses jsonb,
  add column if not exists traveler_responses_submitted_at timestamptz;

create unique index if not exists leads_public_token_key
  on public.leads (public_token)
  where public_token is not null;

comment on column public.leads.public_token is
  'Token d''accès à la page voyageur /q/<token> (service role uniquement, jamais lu via RLS client).';
```

- [ ] **Step 2: Étendre `SupabaseLeadRow`**

Dans `src/lib/supabase-lead-row.ts`, ajouter à l'interface `SupabaseLeadRow` (près de `reference: string | null;`) :

```ts
  public_token: string | null;
  public_token_expires_at: string | null;
  traveler_responses: Record<string, unknown> | null;
  traveler_responses_submitted_at: string | null;
```

Si le fichier construit une liste de colonnes sélectionnées (`select("...")`), y ajouter les 4 noms. Vérifier avec `grep -n "select(" src/lib/leads-server.ts` que les requêtes utilisent `select("*")` ; si des colonnes sont énumérées, compléter.

- [ ] **Step 3: `.env.example`**

Ajouter :

```bash
# Page voyageur de requalification (lien affiché à l'opérateur ; même host que le desk)
NEXT_PUBLIC_TRAVELER_BASE_URL=https://app.directionlalgerie.com
```

- [ ] **Step 4: Appliquer en local et vérifier**

Run: `npx supabase start` (si pas déjà lancé) puis `npm run db:push` — ou exécuter la migration dans le SQL Editor du projet Supabase de dev.
Expected: migration applied ; `select public_token from leads limit 1;` ne renvoie pas d'erreur.

- [ ] **Step 5: Build + commit**

Run: `npm run build`
Expected: succès.

```bash
git add supabase/migrations/20260722120000_traveler_requalification.sql src/lib/supabase-lead-row.ts .env.example
git commit -m "feat: colonnes lead pour la page voyageur de requalification"
```

---

### Task 2: Lib métier `traveler-requalification.ts`

**Files:**
- Create: `src/lib/traveler-requalification.ts`

**Interfaces:**
- Consumes: `getAllOptionIds()` de `@/components/leads/qualification/qualification-blocks-config`.
- Produces: `TravelerResponses`, `parseTravelerResponses(raw: unknown): TravelerResponses | null`, `buildTravelerSummary(row)`, `TOKEN_TTL_DAYS = 30`, `TRAVELER_ENUMS`.

- [ ] **Step 1: Écrire le module complet**

```ts
import { getAllOptionIds } from "@/components/leads/qualification/qualification-blocks-config";

export const TOKEN_TTL_DAYS = 30;
const TEXT_MAX = 500;

export const TRAVELER_ENUMS = {
  rooms: ["two_rooms", "triple", "suite", "advise"],
  passports: ["algerian", "french", "both", "other"],
  flightsMode: ["include", "already_booked", "self_managed"],
  rhythm: ["intense", "slow", "balanced"],
  structure: ["fixed", "flexible", "full_trust"],
  businessMode: ["none", "curiosity", "meetings"],
  accompaniment: ["full_guide", "partial", "advise"],
  board: ["breakfast", "half_board", "mixed", "advise"],
} as const;

export interface TravelerResponses {
  version: 1;
  travelers: { age: number }[];
  rooms: (typeof TRAVELER_ENUMS.rooms)[number];
  passports: (typeof TRAVELER_ENUMS.passports)[number][];
  flights: {
    mode: (typeof TRAVELER_ENUMS.flightsMode)[number];
    departure_city: string;
  };
  wishes: {
    must_see: string[];
    rhythm: (typeof TRAVELER_ENUMS.rhythm)[number];
    structure: (typeof TRAVELER_ENUMS.structure)[number];
    family_days: string;
    notes: string;
  };
  business: {
    mode: (typeof TRAVELER_ENUMS.businessMode)[number];
    details: string;
  };
  constraints: {
    diet: string[];
    accompaniment: (typeof TRAVELER_ENUMS.accompaniment)[number];
    board: (typeof TRAVELER_ENUMS.board)[number];
    notes: string;
  };
}

function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/<[^>]*>/g, "").trim().slice(0, TEXT_MAX);
}

function oneOf<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v)
    ? (v as T[number])
    : null;
}

function gridIds(v: unknown, max = 20): string[] | null {
  if (!Array.isArray(v)) return null;
  const known = getAllOptionIds();
  const out: string[] = [];
  for (const item of v.slice(0, max)) {
    if (typeof item !== "string") return null;
    if (!known.has(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/** Valide un payload inconnu. Retourne null si non conforme (→ 422). */
export function parseTravelerResponses(raw: unknown): TravelerResponses | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const travelersRaw = o.travelers;
  if (!Array.isArray(travelersRaw) || travelersRaw.length < 1 || travelersRaw.length > 8)
    return null;
  const travelers: { age: number }[] = [];
  for (const t of travelersRaw) {
    const age = (t as Record<string, unknown>)?.age;
    if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 110)
      return null;
    travelers.push({ age });
  }

  const rooms = oneOf(TRAVELER_ENUMS.rooms, o.rooms);
  if (!rooms) return null;

  const passportsRaw = o.passports;
  if (!Array.isArray(passportsRaw) || passportsRaw.length !== travelers.length)
    return null;
  const passports: TravelerResponses["passports"] = [];
  for (const p of passportsRaw) {
    const val = oneOf(TRAVELER_ENUMS.passports, p);
    if (!val) return null;
    passports.push(val);
  }

  const flightsO = (o.flights ?? {}) as Record<string, unknown>;
  const flightsMode = oneOf(TRAVELER_ENUMS.flightsMode, flightsO.mode);
  if (!flightsMode) return null;

  const wishesO = (o.wishes ?? {}) as Record<string, unknown>;
  const mustSee = gridIds(wishesO.must_see);
  const rhythm = oneOf(TRAVELER_ENUMS.rhythm, wishesO.rhythm);
  const structure = oneOf(TRAVELER_ENUMS.structure, wishesO.structure);
  if (!mustSee || !rhythm || !structure) return null;

  const businessO = (o.business ?? {}) as Record<string, unknown>;
  const businessMode = oneOf(TRAVELER_ENUMS.businessMode, businessO.mode);
  if (!businessMode) return null;

  const constraintsO = (o.constraints ?? {}) as Record<string, unknown>;
  const diet = gridIds(constraintsO.diet);
  const accompaniment = oneOf(TRAVELER_ENUMS.accompaniment, constraintsO.accompaniment);
  const board = oneOf(TRAVELER_ENUMS.board, constraintsO.board);
  if (!diet || !accompaniment || !board) return null;

  return {
    version: 1,
    travelers,
    rooms,
    passports,
    flights: { mode: flightsMode, departure_city: cleanText(flightsO.departure_city) },
    wishes: {
      must_see: mustSee,
      rhythm,
      structure,
      family_days: cleanText(wishesO.family_days),
      notes: cleanText(wishesO.notes),
    },
    business: { mode: businessMode, details: cleanText(businessO.details) },
    constraints: {
      diet,
      accompaniment,
      board,
      notes: cleanText(constraintsO.notes),
    },
  };
}

export interface TravelerSummary {
  reference: string;
  travelerName: string;
  datesLine: string;
  travelers: string;
  travelStyle: string;
  budget: string;
  tripSummary: string;
}

/** Synthèse publique — ne JAMAIS inclure email/phone. */
export function buildTravelerSummary(row: Record<string, unknown>): TravelerSummary {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const reference = str(row.reference) || `${String(row.id).slice(0, 8)}…`;
  const datesLine = str(row.trip_dates) || "—";
  return {
    reference,
    travelerName: str(row.traveler_name) || "—",
    datesLine,
    travelers: str(row.travelers) || "—",
    travelStyle: str(row.travel_style) || "—",
    budget: str(row.budget) || "—",
    tripSummary: str(row.trip_summary) || "—",
  };
}

export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) || t < Date.now();
}
```

Note : `buildTravelerSummary` reprend la logique dates de `src/lib/supabase-lead-mapper.ts` (`buildDatesLine`) en version simple — si `trip_dates` est vide sur le lead réel, compléter la colonne côté desk plutôt que de complexifier ici.

- [ ] **Step 2: Vérifier compilation + commit**

Run: `npm run build`
Expected: succès (le module n'est pas encore importé, il compile isolément).

```bash
git add src/lib/traveler-requalification.ts
git commit -m "feat: validation et types des réponses voyageur"
```

---

### Task 3: Server action « générer le lien voyageur » + bouton cockpit

**Files:**
- Modify: `src/app/(dashboard)/leads/actions.ts` (ajout en fin de fichier)
- Create: `src/components/leads/traveler-link-button.tsx`
- Modify: `src/components/leads/lead-cockpit-dossier.tsx` (montage du bouton)

**Interfaces:**
- Consumes: `TOKEN_TTL_DAYS` (Task 2) ; pattern action existant (`createClient`, `auth.getUser`, `isUuid`).
- Produces: `generateTravelerLink(leadId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>`.

- [ ] **Step 1: Ajouter l'action (fin de `actions.ts`)**

```ts
export type GenerateTravelerLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Génère (ou régénère) le token public du lead et retourne l'URL voyageur.
 * Régénérer réouvre la soumission (submitted_at → null) en conservant les
 * réponses existantes comme pré-remplissage (spec §4).
 */
export async function generateTravelerLink(
  leadId: string,
): Promise<GenerateTravelerLinkResult> {
  if (!isUuid(leadId)) {
    return { ok: false, error: "Identifiant de lead invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Non authentifié." };
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("leads")
    .update({
      public_token: token,
      public_token_expires_at: expiresAt,
      traveler_responses_submitted_at: null,
    })
    .eq("id", leadId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { headers } = await import("next/headers");
  const h = await headers();
  const base =
    process.env.NEXT_PUBLIC_TRAVELER_BASE_URL?.trim().replace(/\/$/, "") ||
    `https://${h.get("host") ?? "localhost:3000"}`;

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, url: `${base}/q/${token}` };
}
```

Ajouter l'import en tête de fichier : `import { TOKEN_TTL_DAYS } from "@/lib/traveler-requalification";`

- [ ] **Step 2: Créer `traveler-link-button.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, RefreshCw } from "lucide-react";
import { generateTravelerLink } from "@/app/(dashboard)/leads/actions";

type Props = {
  leadId: string;
  /** true si le lead a déjà un public_token (affiche « Régénérer »). */
  hasToken: boolean;
};

export function TravelerLinkButton({ leadId, hasToken }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateTravelerLink(leadId);
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-[var(--steel)]">
        <Link2 className="h-4 w-4" />
        Lien voyageur
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Page publique où le voyageur complète sa qualification (valide 30 jours).
        Régénérer réouvre la soumission.
      </p>
      {url ? (
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs">
            {url}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded bg-[var(--steel)] px-2 py-1 text-xs text-white"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1 rounded bg-[var(--steel)] px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
          {hasToken ? "Régénérer le lien" : "Générer le lien"}
        </button>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Monter dans `LeadCockpitDossier`**

Dans `src/components/leads/lead-cockpit-dossier.tsx` : importer `TravelerLinkButton`, et rendre en fin de composant (après le dernier bloc de la fiche, avant la fermeture du conteneur racine) :

```tsx
<TravelerLinkButton
  leadId={String(lead.id)}
  hasToken={Boolean(lead.public_token)}
/>
```

(`lead` est le `SupabaseLeadRow` reçu en prop ; le champ existe depuis Task 1.)

- [ ] **Step 4: Vérifier en local**

Run: `npm run dev`, ouvrir un lead → onglet dossier.
Expected: carte « Lien voyageur », clic → URL `…/q/<uuid>` copiable ; en base, `public_token` renseigné.

- [ ] **Step 5: Lint + commit**

Run: `npm run lint`
Expected: pas de nouvelle erreur.

```bash
git add src/app/"(dashboard)"/leads/actions.ts src/components/leads/traveler-link-button.tsx src/components/leads/lead-cockpit-dossier.tsx
git commit -m "feat: génération du lien voyageur depuis le cockpit"
```

---

### Task 4: API publique `GET/POST /api/q/[token]`

**Files:**
- Create: `src/app/api/q/[token]/route.ts`

**Interfaces:**
- Consumes: `parseTravelerResponses`, `buildTravelerSummary`, `isTokenExpired` (Task 2) ; `createServiceRoleClient` (`@/lib/supabase/admin`) ; `sendTransactionalHtmlEmail` (`@/lib/email/resend-client`).
- Produces: contrat HTTP de la spec §6, consommé par la page (Task 5-6).

- [ ] **Step 1: Écrire la route**

```ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";
import {
  buildTravelerSummary,
  isTokenExpired,
  parseTravelerResponses,
} from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";

export const runtime = "nodejs";

const LEAD_COLUMNS =
  "id, reference, traveler_name, trip_dates, travelers, travel_style, budget, trip_summary, public_token, public_token_expires_at, traveler_responses, traveler_responses_submitted_at";

async function findLeadByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const lead = await findLeadByToken(token);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isTokenExpired(lead.public_token_expires_at as string | null)) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }
    return NextResponse.json({
      summary: buildTravelerSummary(lead),
      alreadySubmitted: Boolean(lead.traveler_responses_submitted_at),
      existingResponses: lead.traveler_responses ?? null,
    });
  } catch (e) {
    console.error("[api/q] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isUuid(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const responses = parseTravelerResponses(body);
  if (!responses) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  try {
    const lead = await findLeadByToken(token);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isTokenExpired(lead.public_token_expires_at as string | null)) {
      return NextResponse.json({ error: "Expired" }, { status: 410 });
    }
    if (lead.traveler_responses_submitted_at) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("leads")
      .update({
        traveler_responses: responses,
        traveler_responses_submitted_at: new Date().toISOString(),
      })
      .eq("id", String(lead.id));

    if (error) {
      console.error("[api/q] update", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    revalidatePath(`/leads/${String(lead.id)}`);
    revalidatePath("/leads");
    revalidatePath("/dashboard");

    // Notification interne best-effort (dégradé silencieux sans Resend).
    const to =
      process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim();
    if (to) {
      const reference = String(lead.reference ?? String(lead.id).slice(0, 8));
      const result = await sendTransactionalHtmlEmail({
        to,
        subject: `Réponses voyageur reçues — ${reference}`,
        html: `<p>Le voyageur du dossier <strong>${reference}</strong> a complété sa qualification.</p><p>Ouvrez le desk pour consulter ses réponses.</p>`,
      });
      if (!result.ok) console.warn("[api/q] notif email:", result.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/q] POST", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Vérifier au curl (dev server + lead avec token de Task 3)**

```bash
curl -s http://localhost:3000/api/q/<token-généré>            # → 200 {"summary":{...},"alreadySubmitted":false,...}
curl -s http://localhost:3000/api/q/00000000-0000-4000-8000-000000000000   # → 404
curl -s -X POST http://localhost:3000/api/q/<token> -H "Content-Type: application/json" -d "{}"   # → 422
```

Expected: codes ci-dessus. Puis POST avec un payload valide (exemple complet en spec §5) → `{"ok":true}` ; re-POST identique → 409.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/q/[token]/route.ts"
git commit -m "feat: API publique de requalification voyageur (GET/POST /api/q/[token])"
```

---

### Task 5: Layout + page RSC publique `/q/[token]`

**Files:**
- Create: `src/app/q/layout.tsx`
- Create: `src/app/q/[token]/page.tsx`

**Interfaces:**
- Consumes: `buildTravelerSummary`, `isTokenExpired` (Task 2) ; `createServiceRoleClient` ; `DIRECTION_ALG_LOGO_URL` (`@/lib/brand-assets`).
- Produces: rend `<TravelerForm token summary alreadySubmitted existingResponses />` (Task 6).

- [ ] **Step 1: Layout public minimal**

```tsx
import type { ReactNode } from "react";

export default function TravelerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--panel-muted,#f4f7fa)]">{children}</div>
  );
}
```

- [ ] **Step 2: Page RSC**

```tsx
import Image from "next/image";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DIRECTION_ALG_LOGO_URL } from "@/lib/brand-assets";
import {
  buildTravelerSummary,
  isTokenExpired,
} from "@/lib/traveler-requalification";
import { isUuid } from "@/lib/is-uuid";
import { TravelerForm } from "./traveler-form";

export const dynamic = "force-dynamic";

const LEAD_COLUMNS =
  "id, reference, traveler_name, trip_dates, travelers, travel_style, budget, trip_summary, public_token_expires_at, traveler_responses, traveler_responses_submitted_at";

function ExpiredScreen() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-[family-name:var(--font-display,Cormorant_Garamond)] text-2xl text-[var(--steel)]">
        Ce lien n'est plus actif
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Pour reprendre votre projet de voyage, écrivez-nous — nous vous
        renverrons un lien personnel en quelques minutes.
      </p>
      <a
        href="https://www.directionlalgerie.com"
        className="mt-6 inline-block rounded bg-[var(--steel)] px-4 py-2 text-sm text-white"
      >
        Direction l'Algérie
      </a>
    </main>
  );
}

export default async function TravelerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isUuid(token)) return <ExpiredScreen />;

  const supabase = createServiceRoleClient();
  const { data: lead } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("public_token", token)
    .maybeSingle();

  if (!lead || isTokenExpired(lead.public_token_expires_at as string | null)) {
    return <ExpiredScreen />;
  }

  const summary = buildTravelerSummary(lead as Record<string, unknown>);

  return (
    <main className="mx-auto max-w-2xl pb-16">
      <header className="bg-[var(--steel)] px-5 py-6 text-white sm:rounded-b-2xl">
        <Image
          src={DIRECTION_ALG_LOGO_URL}
          alt="Direction l'Algérie"
          width={180}
          height={48}
          className="h-10 w-auto object-contain"
          unoptimized
        />
        <p className="mt-4 text-xs uppercase tracking-widest text-white/70">
          Votre projet de voyage · {summary.reference}
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display,Cormorant_Garamond)] text-3xl">
          {summary.travelerName}
        </h1>
      </header>
      <TravelerForm
        token={token}
        summary={summary}
        alreadySubmitted={Boolean(lead.traveler_responses_submitted_at)}
        existingResponses={lead.traveler_responses ?? null}
      />
    </main>
  );
}
```

Note : si `next.config.ts` restreint les domaines d'images, `unoptimized` évite la config `images.remotePatterns` pour le logo Squarespace CDN. Vérifier le rendu ; sinon ajouter le pattern dans `next.config.ts`.

- [ ] **Step 3: Vérifier (page s'affiche, sections form arrivent en Task 6)**

Run: `npm run dev` → ouvrir `http://localhost:3000/q/<token>`.
Expected: bandeau steel + logo + référence + nom ; erreur d'import `TravelerForm` attendue tant que Task 6 n'est pas faite → créer d'abord un stub minimal si l'on veut vérifier isolément, ou enchaîner Task 6 avant la vérif.

- [ ] **Step 4: Commit (avec Task 6 si stub non souhaité)**

```bash
git add src/app/q/layout.tsx "src/app/q/[token]/page.tsx"
git commit -m "feat: page publique voyageur /q/[token] (RSC + écrans dégradés)"
```

---

### Task 6: Formulaire client `traveler-form.tsx`

> **Référence visuelle validée :** `docs/mockups/traveler-page-mockup.html` (maquette approuvée le 2026-07-22 — ouvrir dans un navigateur). Reproduire sa hiérarchie, ses widgets (chips, radio-cartes, rail synthèse gold) et sa copy. Polices réelles à charger via `next/font/google` dans `src/app/q/layout.tsx` : Cormorant Garamond (500/600 + italic 500) et Poppins (400/500/600) — le layout racine ne charge qu'Inter/JetBrains Mono.

**Files:**
- Create: `src/app/q/[token]/traveler-form.tsx`

**Interfaces:**
- Consumes: `POST /api/q/<token>` (Task 4) ; `TravelerSummary`, `TravelerResponses`, `TRAVELER_ENUMS` (Task 2) ; options grille de `qualification-blocks-config.ts`.
- Produces: l'expérience formulaire complète (6 sections, écran merci).

- [ ] **Step 1: Constantes d'options (labels FR voyageur)**

En tête du fichier (après les imports), définir les options affichées. Les `id` doivent correspondre à la spec §5 / aux ids grille :

```tsx
const MUST_SEE_OPTIONS = [
  { id: "casbah", label: "Casbah d'Alger" },
  { id: "tipaza", label: "Tipaza & ruines romaines" },
  { id: "constantine", label: "Constantine" },
  { id: "kabylie", label: "Kabylie" },
  { id: "bejaia", label: "Béjaïa & la côte" },
  { id: "ghardaia", label: "Ghardaïa / M'Zab", hint: "chaud en août" },
  { id: "sahara", label: "Sahara / dunes", hint: "saison oct–avril" },
  { id: "hoggar", label: "Hoggar / Tamanrasset", hint: "saison oct–avril" },
  { id: "tassili", label: "Tassili n'Ajjer", hint: "saison oct–avril" },
];

const DIET_OPTIONS = [
  { id: "halal", label: "Halal strict" },
  { id: "vegetarian", label: "Végétarien / végétalien" },
  { id: "allergies", label: "Allergies alimentaires" },
  { id: "no_alcohol", label: "Sans alcool" },
  { id: "mobility", label: "Mobilité réduite" },
  { id: "child_friendly", label: "Adapté aux jeunes enfants" },
];

const ROOMS_OPTIONS = [
  { id: "two_rooms", label: "Deux chambres" },
  { id: "triple", label: "Une chambre triple" },
  { id: "suite", label: "Suite familiale" },
  { id: "advise", label: "Conseillez-nous" },
];

const PASSPORT_OPTIONS = [
  { id: "algerian", label: "Algérien" },
  { id: "french", label: "Français" },
  { id: "both", label: "Les deux" },
  { id: "other", label: "Autre" },
];

const FLIGHTS_OPTIONS = [
  { id: "include", label: "À intégrer au dossier" },
  { id: "already_booked", label: "Déjà réservés" },
  { id: "self_managed", label: "Je m'en occupe" },
];

const RHYTHM_OPTIONS = [
  { id: "intense", label: "On bouge beaucoup" },
  { id: "balanced", label: "Équilibré" },
  { id: "slow", label: "Tranquille, on savoure" },
];

const STRUCTURE_OPTIONS = [
  { id: "fixed", label: "Itinéraire précis" },
  { id: "flexible", label: "Trame souple" },
  { id: "full_trust", label: "On vous fait confiance" },
];

const BUSINESS_OPTIONS = [
  { id: "curiosity", label: "Simple curiosité au fil du voyage" },
  { id: "meetings", label: "Organiser des rencontres pro" },
  { id: "none", label: "Pas un sujet" },
];

const ACCOMPANIMENT_OPTIONS = [
  { id: "full_guide", label: "Chauffeur-guide tout le séjour" },
  { id: "partial", label: "Ponctuel selon les étapes" },
  { id: "advise", label: "Conseillez-nous" },
];

const BOARD_OPTIONS = [
  { id: "breakfast", label: "Petits-déjeuners" },
  { id: "half_board", label: "Demi-pension" },
  { id: "mixed", label: "Mixte selon les étapes" },
  { id: "advise", label: "Conseillez-nous" },
];
```

- [ ] **Step 2: Widgets génériques (même fichier)**

```tsx
type Opt = { id: string; label: string; hint?: string };

function ChipsMulti({
  options, value, onChange,
}: { options: Opt[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((x) => x !== o.id) : [...value, o.id])
            }
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? "border-[var(--steel)] bg-[var(--steel)] text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {o.label}
            {o.hint ? <span className="ml-1 text-xs opacity-70">({o.hint})</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function RadioCards({
  options, value, onChange,
}: { options: Opt[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
            value === o.id
              ? "border-[var(--steel)] bg-[var(--steel)]/5 font-medium text-[var(--steel)]"
              : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          {o.label}
          {o.hint ? <div className="text-xs text-slate-500">{o.hint}</div> : null}
        </button>
      ))}
    </div>
  );
}

function Section({
  index, title, children,
}: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--steel)]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--steel)] text-xs text-white">
          {index}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Composant principal**

State : un objet `form` reflétant `TravelerResponses` (sans `version`), initialisé depuis `existingResponses` si présent, sinon valeurs vides (`travelers: [{ age: 0 }, { age: 0 }, { age: 0 }]` calé sur `summary.travelers` si parseable, `must_see: []`, enums à `null`). Soumission :

```tsx
async function submit() {
  setError(null);
  // validation client minimale : âges renseignés, enums choisis
  if (form.travelers.some((t) => !t.age)) return setError("Indiquez l'âge de chaque voyageur.");
  if (!form.rooms || !form.flights.mode || !form.wishes.rhythm || !form.wishes.structure || !form.business.mode || !form.constraints.accompaniment || !form.constraints.board)
    return setError("Merci de répondre à chaque question (les champs texte sont optionnels).");
  setPending(true);
  try {
    const res = await fetch(`/api/q/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, ...form }),
    });
    if (res.status === 409) return setDone(true); // déjà soumis = état final équivalent
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setDone(true);
  } catch {
    setError("L'envoi a échoué. Réessayez, ou répondez simplement à notre email.");
  } finally {
    setPending(false);
  }
}
```

Rendu, dans l'ordre :
1. **Carte synthèse** : liste `summary` (dates, voyageurs, style, budget, résumé) + encart saison : *« Fin août, cap sur le Nord — Alger, sites antiques, Constantine, Kabylie et la côte. Le Grand Sud se vit d'octobre à avril : nous vous le garderons pour un prochain voyage. »*
2. **Section 1 — Qui voyage ?** : pour chaque voyageur, `input type="number" inputMode="numeric" min=0 max=110` « Âge du voyageur N » + boutons ajouter/retirer un voyageur (1..8, resynchronise `passports`) ; puis `RadioCards ROOMS_OPTIONS` (« Configuration des chambres »).
3. **Section 2 — Passeports** : par voyageur, `RadioCards PASSPORT_OPTIONS` (« Voyageur N — passeport utilisé »).
4. **Section 3 — Vols** : `RadioCards FLIGHTS_OPTIONS` + `input` texte « Ville de départ » (`form.flights.departure_city`).
5. **Section 4 — Envies & rythme** : `ChipsMulti MUST_SEE_OPTIONS` (« Ce qui vous attire déjà ») + `RadioCards RHYTHM_OPTIONS` + `RadioCards STRUCTURE_OPTIONS` + `textarea` « Famille à visiter, jours à garder libres ? » (`family_days`) + `textarea` « Autre chose à nous dire ? » (`notes`), maxLength 500.
6. **Section 5 — L'Algérie business** : `RadioCards BUSINESS_OPTIONS` + si `meetings` : `input` « Précisez (secteur, type de rencontres) » (`details`).
7. **Section 6 — Confort & contraintes** : `ChipsMulti DIET_OPTIONS` + `RadioCards ACCOMPANIMENT_OPTIONS` + `RadioCards BOARD_OPTIONS` + `textarea` « Santé, mobilité, autres précisions » (`constraints.notes`).
8. **Bouton** « Envoyer mes réponses » (`disabled={pending}`, pleine largeur mobile, fond `var(--steel)`).

Écrans alternatifs : si `alreadySubmitted` au chargement ou `done` → carte de remerciement : *« Merci ! Nous avons bien reçu vos réponses. Notre équipe prépare votre première proposition d'itinéraire — vous l'aurez dans les prochains jours. »* (pas de mention agences/IA).

- [ ] **Step 4: Parcours navigateur complet**

Run: `npm run dev` → `/q/<token>` sur viewport mobile (DevTools 375px).
Expected: 6 sections remplissables au pouce ; envoi → merci ; recharger → merci direct (`alreadySubmitted`) ; en base `traveler_responses` conforme spec §5.

- [ ] **Step 5: Lint + build + commit**

Run: `npm run lint` puis `npm run build`
Expected: succès.

```bash
git add "src/app/q/[token]/traveler-form.tsx"
git commit -m "feat: formulaire voyageur 6 sections (mobile-first, design DA)"
```

---

### Task 7: Middleware — routes publiques /q sur le host du desk

Contexte : les pages voyageur sont sur `app.directionlalgerie.com`, le même host que le desk (décision 2026-07-22). Il n'y a donc **pas** d'isolation host-based ni de redirection à faire — `/q/*` est déjà public car hors de `(dashboard)`. On ajoute seulement un court-circuit de `updateSession` sur ces chemins : un visiteur anonyme n'a pas de cookie Supabase à rafraîchir, et ça évite un aller-retour auth inutile sur la page publique.

**Files:**
- Modify: `middleware.ts` (racine)

**Interfaces:**
- Consumes: `updateSession` existant (inchangé).
- Produces: bypass de `updateSession` sur `/q/*` + `/api/q/*` ; tout le reste inchangé.

- [ ] **Step 1: Remplacer le corps du middleware**

```ts
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isTravelerPath(pathname: string): boolean {
  return (
    pathname === "/q" ||
    pathname.startsWith("/q/") ||
    pathname.startsWith("/api/q/")
  );
}

export async function middleware(request: NextRequest) {
  // Routes publiques voyageur : aucune session Supabase à rafraîchir.
  if (isTravelerPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Vérifier en local (desk intact + /q public)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/q/<token-généré>   # → 200 (page publique)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login              # → 200 (desk intact)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard          # → redirige /login si non authentifié (inchangé)
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: routes publiques /q hors du refresh de session middleware"
```

---

### Task 8: Panneau « Réponses voyageur » + docs + vérification finale

**Files:**
- Create: `src/components/leads/traveler-responses-panel.tsx`
- Modify: `src/components/leads/lead-cockpit-dossier.tsx` (montage sous le bouton lien)
- Modify: `docs/USER_JOURNEYS.md` (nouvelle section parcours), `CLAUDE.md` (routes publiques + env), `.env.example` (déjà fait Task 1 — vérifier)

**Interfaces:**
- Consumes: `TravelerResponses` (Task 2), labels des constantes de Task 6 (dupliquer les maps id→label FR ici, côté desk, dans le panneau — pas d'import depuis `src/app/q/`).

- [ ] **Step 1: Panneau lecture seule**

Composant serveur simple : prop `responses: Record<string, unknown> | null`, `submittedAt: string | null`. Si null → ne rien rendre. Sinon parser avec `parseTravelerResponses` (réutilisé côté lecture : garantit la forme) et afficher par section : âges + chambres, passeports (par voyageur), vols + ville, envies (labels FR des ids via une map locale `ID_LABELS: Record<string, string>` couvrant les ids de Task 6), rythme/structure, business, contraintes, notes libres, avec l'horodatage formaté via `formatDateFr`-like local. Style : carte `rounded-lg border bg-white p-3 text-sm`, titres `text-[var(--steel)] font-medium`.

- [ ] **Step 2: Monter dans `LeadCockpitDossier`** juste sous `<TravelerLinkButton …/>` :

```tsx
<TravelerResponsesPanel
  responses={lead.traveler_responses}
  submittedAt={lead.traveler_responses_submitted_at}
/>
```

- [ ] **Step 3: Docs**

- `docs/USER_JOURNEYS.md` : section « Lien voyageur & requalification » — génération, envoi manuel, soumission unique, régénération = réouverture, lecture cockpit (obligatoire : CONTRIBUTING exige la mise à jour de ce doc pour tout changement lead/workflow).
- `CLAUDE.md` : dans Architecture, mentionner routes publiques `/q/[token]` + `/api/q/[token]` (service role, hébergées sur `app.directionlalgerie.com` avec le desk) et l'env `NEXT_PUBLIC_TRAVELER_BASE_URL`.

- [ ] **Step 4: Vérification finale Phase A**

Run: `npm run lint && npm run build`, puis parcours complet en dev : générer lien → ouvrir → soumettre → panneau cockpit affiche les réponses → régénérer → page pré-remplie modifiable → re-soumettre.
Expected: tout passe.

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/traveler-responses-panel.tsx src/components/leads/lead-cockpit-dossier.tsx docs/USER_JOURNEYS.md CLAUDE.md
git commit -m "feat: panneau réponses voyageur au cockpit + docs parcours"
```

---

## Phase B — Infra & remise en route 🖐️ (actions Mehdi, assistées)

### Task 9: Rebrancher le Travel Lead Desk (Vercel + Supabase)

Contexte : Vercel est connecté à `app.directionlalgerie.com` ; l'état prod n'a pas été vérifié récemment ; l'intake Squarespace a raté un lead le 2026-07-22 (diagnostic séparé). Projet Supabase prod : `gfftkoxpjovnwtmkcxgi`.

- [ ] Vercel → projet desk : vérifier que le dernier deploy `main` est vert et servi sur `app.directionlalgerie.com` ; sinon relancer et lire les logs.
- [ ] Vercel → Settings → Environment Variables : vérifier présence (Production) de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (indispensable aux routes `/api/q` et `/api/intake`), et noter l'état de `RESEND_API_KEY`/`RESEND_FROM_EMAIL`/`NEXT_PUBLIC_DA_CONTACT_EMAIL` (notification soumission), `ALLOWED_ORIGIN`/`INTAKE_SHARED_SECRET` (bug intake).
- [ ] Supabase prod : vérifier que TOUTES les migrations sont appliquées, y compris la nouvelle :

```sql
select column_name from information_schema.columns
where table_name = 'leads' and column_name in
  ('public_token','public_token_expires_at','traveler_responses','traveler_responses_submitted_at');
-- attendu : 4 lignes. Sinon : npm run db:push (requiert `supabase login` + mot de passe DB) ou SQL Editor dans l'ordre des fichiers.
```

- [ ] Supabase Auth → URL configuration : Site URL + Redirect URLs conformes à `docs/DEPLOY_VERCEL.md` §2.2 (inclure `https://app.directionlalgerie.com/**`).

### Task 10: Env + déploiement (domaine déjà connecté)

Pas de domaine ni de CNAME à créer : `app.directionlalgerie.com` est déjà le host du projet. Les pages `/q/*` partent avec le déploiement du code (Phase A).

- [ ] Vercel env (Production) : ajouter `NEXT_PUBLIC_TRAVELER_BASE_URL=https://app.directionlalgerie.com`.
- [ ] Merger la branche `feat/traveler-requalification-page` → `main` (PR) : Vercel redéploie automatiquement.
- [ ] Vérifier : `https://app.directionlalgerie.com/q/<token-test>` s'ouvre en public ; `https://app.directionlalgerie.com/login` répond normalement (desk intact).
- [ ] (Optionnel, futur) Si un lien client plus « parlant » est souhaité un jour : ajouter `voyage.directionlalgerie.com` en domaine Vercel + CNAME et pointer l'env dessus — aucun changement de code.

### Task 11: Recette prod

- [ ] Créer un lead de test dans le desk prod → générer le lien → parcours mobile réel complet → soumission visible au cockpit → supprimer le lead de test.
- [ ] Si Resend configuré : vérifier réception de la notification interne.

## Phase C — Opération lead DA-2026-0001 (Mohand Lafreche)

- [ ] Saisir le lead dans le desk (intake manuel) : Mohand LAFRECHE, moh.laf@yahoo.fr, +33 6 10 20 30 40, 3 voyageurs famille, 2026-08-20 → 2026-09-03, budget « 3 000–4 000 € / pers (9 000 € groupe) », style « Mixte charme/5*/exception », résumé = texte du formulaire Voyage Planner. Allouer la référence (l'outil génère `DA-2026-NNNN`).
- [ ] Générer le lien voyageur, l'insérer dans l'email court (voir `Claude/da-leads/DA-2026-0001-mohand-lafreche/01-email-qualification.md`, version courte) et envoyer depuis la boîte DA.
- [ ] Relance WhatsApp à J+2 sans réponse ; dès soumission : compléter le brief agences (`02-brief-agents-template.md`).

---

## Self-review (fait à la rédaction)

- Spec §3→Task 1, §4→Tasks 3/4, §5→Tasks 2/6, §6→Task 4, §7→Tasks 5/6, §8→Tasks 3/8, §9→Tasks 7/10, §12→Tasks 9-11, §13→Tasks 8/11. Pas de section orpheline.
- Types cohérents : `TravelerResponses`/`parseTravelerResponses`/`buildTravelerSummary` définis Task 2, consommés Tasks 4/5/6/8 sous les mêmes noms ; `generateTravelerLink` défini Task 3, consommé Task 3 Step 2.
- Pas de framework de test introduit (contrainte repo) ; chaque tâche porte ses vérifications exécutables.
