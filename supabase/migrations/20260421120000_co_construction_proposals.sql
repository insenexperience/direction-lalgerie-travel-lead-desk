-- Propositions de circuit (co-construction) puis lien vers devis généré.

create type public.co_construction_proposal_status as enum (
  'awaiting_agency',
  'submitted',
  'approved'
);

create table public.lead_circuit_proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  title text not null default 'Proposition de circuit',
  circuit_outline text not null default '',
  status public.co_construction_proposal_status not null default 'awaiting_agency',
  version integer not null default 1,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles (id) on delete set null,
  converted_quote_id uuid references public.quotes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_circuit_proposals_lead_id_idx
  on public.lead_circuit_proposals (lead_id, created_at desc);

create trigger lead_circuit_proposals_touch_updated_at
  before update on public.lead_circuit_proposals
  for each row execute function public.touch_updated_at();

alter table public.lead_circuit_proposals enable row level security;

create policy "lead_circuit_proposals_all_authenticated"
  on public.lead_circuit_proposals
  for all
  to authenticated
  using (true)
  with check (true);
