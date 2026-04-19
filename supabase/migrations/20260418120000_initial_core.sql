-- Travel Lead Desk — core schema (Supabase / Postgres).
-- Apply in Supabase SQL editor or via Supabase CLI (`supabase db push`).
-- RLS: permissive for `authenticated` until the two-level authorization matrix is defined (see docs/PRODUCT_SPEC.md).

create type public.app_role as enum ('admin', 'lead_referent');

create type public.lead_status as enum (
  'new',
  'qualification',
  'refinement',
  'agency_assignment',
  'co_construction',
  'quote',
  'negotiation',
  'won',
  'lost'
);

create type public.partner_agency_type as enum (
  'dmc',
  'travel_agency',
  'tour_operator',
  'other'
);

create type public.partner_agency_status as enum (
  'active',
  'pending_validation',
  'suspended'
);

create type public.agency_consultation_status as enum (
  'invited',
  'pending',
  'quote_received',
  'declined',
  'reminded',
  'expired'
);

create type public.quote_kind as enum (
  'agency_internal',
  'da_traveler'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'lead_referent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  type public.partner_agency_type not null default 'other',
  country text not null default '',
  city text not null default '',
  website text,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  destinations text not null default '',
  languages text not null default '',
  segments text not null default '',
  sla_quote_days integer not null default 5,
  status public.partner_agency_status not null default 'pending_validation',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  referent_id uuid references public.profiles (id) on delete set null,
  traveler_name text not null,
  email text not null default '',
  phone text not null default '',
  status public.lead_status not null default 'new',
  source text not null default '',
  trip_summary text not null default '',
  travel_style text not null default '',
  travelers text not null default '',
  budget text not null default '',
  trip_dates text not null default '',
  qualification_summary text not null default '',
  internal_notes text not null default '',
  quote_status text not null default '',
  starred boolean not null default false,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  retained_agency_id uuid references public.agencies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_referent_id_idx on public.leads (referent_id);
create index leads_status_idx on public.leads (status);
create index leads_created_at_idx on public.leads (created_at desc);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  status public.agency_consultation_status not null default 'invited',
  quote_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, agency_id)
);

create index consultations_lead_id_idx on public.consultations (lead_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  consultation_id uuid references public.consultations (id) on delete set null,
  kind public.quote_kind not null,
  status text not null default 'draft',
  summary text,
  is_traveler_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_lead_id_idx on public.quotes (lead_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index activities_lead_id_idx on public.activities (lead_id, created_at desc);

create table public.lead_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (lead_id, version)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'lead_referent'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger agencies_touch_updated_at
  before update on public.agencies
  for each row execute function public.touch_updated_at();

create trigger leads_touch_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

create trigger consultations_touch_updated_at
  before update on public.consultations
  for each row execute function public.touch_updated_at();

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.agencies enable row level security;
alter table public.leads enable row level security;
alter table public.consultations enable row level security;
alter table public.quotes enable row level security;
alter table public.activities enable row level security;
alter table public.lead_snapshots enable row level security;

-- TODO: replace with referent-scoped + admin policies (PRODUCT_SPEC §7.1).
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "agencies_all_authenticated"
  on public.agencies for all to authenticated using (true) with check (true);

create policy "leads_all_authenticated"
  on public.leads for all to authenticated using (true) with check (true);

create policy "consultations_all_authenticated"
  on public.consultations for all to authenticated using (true) with check (true);

create policy "quotes_all_authenticated"
  on public.quotes for all to authenticated using (true) with check (true);

create policy "activities_all_authenticated"
  on public.activities for all to authenticated using (true) with check (true);

create policy "lead_snapshots_all_authenticated"
  on public.lead_snapshots for all to authenticated using (true) with check (true);
