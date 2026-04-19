# Implémentation v2 — reste à faire en mode Agent

L’exécution complète du plan (SQL, TypeScript, suppression `@dnd-kit`, etc.) nécessite **Cursor en mode Agent** : en « Plan mode » seuls certains fichiers Markdown peuvent être modifiés.

## 1. Migration Supabase (à créer)

Créer `supabase/migrations/20260428100000_travel_lead_desk_v2.sql` avec le contenu suivant, puis `npm run db:push` (ou équivalent) :

```sql
-- Travel Lead Desk v2 — IA, WhatsApp, qualification, co-construction enrichie.
-- Voir docs/PRD_TRAVEL_LEAD_DESK_V2.md (source produit).

alter table public.leads
  add column if not exists intake_channel text
    check (intake_channel is null or intake_channel in ('manual', 'whatsapp', 'web_form', 'email')),
  add column if not exists whatsapp_phone_number text,
  add column if not exists whatsapp_thread_id text,
  add column if not exists conversation_transcript jsonb not null default '[]'::jsonb,
  add column if not exists ai_qualification_payload jsonb,
  add column if not exists ai_qualification_confidence numeric(3,2),
  add column if not exists scoring_weights jsonb,
  add column if not exists qualification_validated_at timestamptz,
  add column if not exists qualification_validated_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists qualification_validation_status text
    not null default 'pending'
    check (qualification_validation_status in ('pending','validated','overridden','rejected')),
  add column if not exists manual_takeover boolean not null default false;

update public.leads
set intake_channel = case
  when submission_id is not null then 'web_form'
  else coalesce(intake_channel, 'manual')
end
where intake_channel is null;

alter table public.leads
  drop column if exists crm_feasibility_band,
  drop column if exists crm_primary_objection,
  drop column if exists crm_commercial_priority;

alter table public.agencies
  add column if not exists circuits_data jsonb not null default '[]'::jsonb,
  add column if not exists availability_calendar jsonb,
  add column if not exists performance_history jsonb not null default '{}'::jsonb,
  add column if not exists ai_capabilities_summary text;

alter table public.lead_circuit_proposals
  add column if not exists ai_suggested boolean not null default false,
  add column if not exists ai_match_score numeric(3,2),
  add column if not exists ai_match_rationale text,
  add column if not exists ai_recommended boolean not null default false,
  add column if not exists agency_proposal_payload jsonb,
  add column if not exists agency_proposal_received_at timestamptz,
  add column if not exists ai_proposal_score numeric(3,2),
  add column if not exists ai_proposal_rationale text,
  add column if not exists annotation_status text
    not null default 'pending'
    check (annotation_status in ('pending','validated','overridden')),
  add column if not exists operator_annotation jsonb,
  add column if not exists annotation_reviewed_at timestamptz,
  add column if not exists annotation_reviewed_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists conversation_score integer
    check (conversation_score is null or conversation_score between 1 and 5),
  add column if not exists conversation_score_rationale text;

alter table public.quotes
  add column if not exists sent_at timestamptz,
  add column if not exists sent_via text
    check (sent_via is null or sent_via in ('whatsapp', 'email', 'manual')),
  add column if not exists pdf_storage_path text;

create index if not exists leads_intake_channel_idx on public.leads (intake_channel);
create index if not exists leads_qualification_status_idx
  on public.leads (qualification_validation_status)
  where qualification_validation_status = 'pending';
create index if not exists lcp_annotation_status_idx
  on public.lead_circuit_proposals (annotation_status)
  where annotation_status = 'pending';
create index if not exists lcp_lead_agency_idx
  on public.lead_circuit_proposals (lead_id, agency_id);

drop table if exists public.lead_snapshots cascade;
```

Mettre à jour `supabase/scripts/clear_demo_data.sql` : retirer toute référence à `lead_snapshots`.

## 2. Code applicatif (checklist)

- Retirer `src/context/agencies-demo-context.tsx` et `AgenciesDemoProvider` du layout dashboard ; brancher les écrans sur Supabase uniquement.
- Étendre `src/lib/leads-server.ts` + `supabase-lead-mapper.ts` pour joindre `consultations` + noms d’agences ; actions serveur `insert`/`update` `consultations`.
- Remplacer le Kanban `@dnd-kit` par un **select de statut** sur chaque carte (`src/components/leads-kanban-board.tsx`) ; retirer les deps `@dnd-kit/*` de `package.json`.
- `claimLead`, `assignLeadReferent` avec lecture ancien `referent_id` + appel `triggerQualificationConversation` (`src/app/(dashboard)/leads/ai-actions.ts`).
- Module `src/lib/ai/*`, client WhatsApp `src/lib/whatsapp/client.ts`, route `src/app/api/whatsapp/webhook/route.ts`, `src/lib/supabase/admin.ts` (service role).
- CRM : retirer champs supprimés de `crm-fields.ts`, `supabase-lead-row.ts`, `lead-commercial-crm-form.tsx`, `lead-read-only-summary.tsx`, `leads/[id]/page.tsx`, `updateLeadCommercialCrm` dans `actions.ts`.
- Route PDF : contrôle explicite `leads.select('id').eq('id', leadId)` avant rendu.
- Fiche lead : `notFound()` si id non-UUID ; supprimer `lead-detail-view.tsx` / `lead-agency-workflow.tsx` si devenus inutiles.
- Inbox dashboard, inbox filtres §7.4, envoi devis §9.5, Cmd+K : selon priorités du plan.

## 3. `.env.example` (fichier non modifiable en plan mode)

Ajouter manuellement (ou en mode Agent) :

```env
# SUPABASE_SERVICE_ROLE_KEY=...   # webhooks uniquement, jamais NEXT_PUBLIC_
# OPENAI_API_KEY=...
# OPENAI_MODEL=gpt-4o
# WHATSAPP_API_TOKEN=...
# WHATSAPP_PHONE_NUMBER_ID=...
# WHATSAPP_VERIFY_TOKEN=...
# WHATSAPP_WEBHOOK_SECRET=...
```

## 4. Déjà fait (docs)

- [`PRD_TRAVEL_LEAD_DESK_V2.md`](./PRD_TRAVEL_LEAD_DESK_V2.md) ajouté.
- [`HERCULES_AUDIT.md`](./HERCULES_AUDIT.md) supprimé.
- [`README.md`](../README.md) et [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) pointent vers le PRD v2.

---

**Action** : dans Cursor, activer **mode Agent** (la demande « exécute le plan » a été bloquée tant que le dépôt restait en plan mode), puis demander « continue l’implémentation v2 » en s’appuyant sur ce fichier et sur [`PRD_TRAVEL_LEAD_DESK_V2.md`](./PRD_TRAVEL_LEAD_DESK_V2.md).
