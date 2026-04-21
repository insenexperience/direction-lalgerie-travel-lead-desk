-- PRD Refonte v1 — Colonnes financières structurées + contact FK + soft delete
-- Dépend de : 20260521_001 (pipeline_stages), 20260521_002 (contacts enrichis)

-- ─── Budget numérique structuré ───────────────────────────────────────────────
alter table public.leads
  add column if not exists budget_min  numeric(10,2),
  add column if not exists budget_max  numeric(10,2),
  add column if not exists budget_unit text check (budget_unit in ('per_person', 'total'));

-- ─── Voyageurs structurés ─────────────────────────────────────────────────────
alter table public.leads
  add column if not exists travelers_adults   integer not null default 1 check (travelers_adults >= 0),
  add column if not exists travelers_children integer not null default 0 check (travelers_children >= 0);

-- ─── Période structurée ───────────────────────────────────────────────────────
alter table public.leads
  add column if not exists travel_period     text,
  add column if not exists travel_start_date date,
  add column if not exists travel_end_date   date;

-- ─── Description projet ───────────────────────────────────────────────────────
alter table public.leads
  add column if not exists project_description text;

-- ─── Devise (forcée EUR via contrainte dans 005) ──────────────────────────────
alter table public.leads
  add column if not exists currency text not null default 'EUR';

-- ─── Lien Contact ─────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists leads_contact_id_idx on public.leads (contact_id);

-- ─── Cycle de vie ─────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists closed_at  timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists leads_deleted_at_idx on public.leads (deleted_at) where deleted_at is null;

-- ─── Canal simplifié ──────────────────────────────────────────────────────────
-- Alias de intake_channel pour simplification UI
alter table public.leads
  add column if not exists channel text;

-- Remplir channel depuis intake_channel existant
update public.leads
set channel = intake_channel
where intake_channel is not null and channel is null;
