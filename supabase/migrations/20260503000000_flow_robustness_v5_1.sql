-- P0 — Flow Robustesse v5.1
-- Prérequis : migrations 20260502* déjà appliquées

-- ─── 1. app_settings (compteur round-robin) ─────────────────────────────────

create table if not exists public.app_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_auth" on public.app_settings;
create policy "app_settings_select_auth"
  on public.app_settings for select to authenticated using (true);

insert into public.app_settings (key, value)
  values ('round_robin_referent_counter', '0'::jsonb)
  on conflict (key) do nothing;

-- ─── 2. Fonction round-robin ──────────────────────────────────────────────────

create or replace function public.allocate_next_referent()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referents uuid[];
  v_counter   integer;
  v_idx       integer;
begin
  select array_agg(id order by id)
  into v_referents
  from public.profiles
  where role in ('lead_referent', 'admin');

  if v_referents is null or array_length(v_referents, 1) = 0 then
    return null;
  end if;

  update public.app_settings
    set value      = to_jsonb(((value #>> '{}')::integer + 1)),
        updated_at = now()
    where key = 'round_robin_referent_counter'
    returning (value #>> '{}')::integer into v_counter;

  v_idx := ((v_counter - 1) % array_length(v_referents, 1)) + 1;
  return v_referents[v_idx];
end;
$$;

-- ─── 3. Leads orphelins existants → allocation ───────────────────────────────

update public.leads
  set referent_id          = public.allocate_next_referent(),
      referent_assigned_at = now()
  where referent_id is null;

-- ─── 4. Trigger auto-allocation à la création ────────────────────────────────

create or replace function public.auto_allocate_referent_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referent_id is null then
    new.referent_id := public.allocate_next_referent();
    if new.referent_id is not null then
      new.referent_assigned_at := coalesce(new.referent_assigned_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_auto_allocate_referent on public.leads;
create trigger leads_auto_allocate_referent
  before insert on public.leads
  for each row execute function public.auto_allocate_referent_on_insert();

-- ─── 5. Enrichissement contacts ──────────────────────────────────────────────

alter table public.contacts
  add column if not exists project_snapshot jsonb,
  add column if not exists lost_reason      text,
  add column if not exists traveler_notes   text;

-- Index unique sur source_lead_id (pour upsert trigger)
create unique index if not exists contacts_source_lead_unique
  on public.contacts(source_lead_id)
  where source_lead_id is not null;

-- ─── 6. Trigger sync_contact_from_lead ───────────────────────────────────────

create or replace function public.sync_contact_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project jsonb;
  v_type    text;
begin
  if new.status not in ('won', 'lost') then return new; end if;
  if old.status = new.status             then return new; end if;

  v_type := case when new.status = 'won' then 'traveler' else 'seeker' end;

  v_project := jsonb_build_object(
    'reference',              new.reference,
    'trip_summary',           new.trip_summary,
    'travel_style',           new.travel_style,
    'travelers',              new.travelers,
    'budget',                 new.budget,
    'trip_dates',             new.trip_dates,
    'qualification_summary',  new.qualification_summary,
    'retained_agency_id',     new.retained_agency_id,
    'source',                 new.source,
    'final_status',           new.status,
    'snapshot_at',            now()
  );

  insert into public.contacts (
    type, source_lead_id, full_name, email, phone,
    whatsapp_phone_number, won_at, lost_at, lost_reason, project_snapshot
  ) values (
    v_type,
    new.id,
    new.traveler_name,
    new.email,
    new.phone,
    new.whatsapp_phone_number,
    case when new.status = 'won'  then now() else null end,
    case when new.status = 'lost' then now() else null end,
    case when new.status = 'lost' then new.internal_notes else null end,
    v_project
  )
  on conflict (source_lead_id) do update set
    type             = excluded.type,
    won_at           = case when excluded.type = 'traveler' then now() else contacts.won_at  end,
    lost_at          = case when excluded.type = 'seeker'   then now() else contacts.lost_at end,
    project_snapshot = excluded.project_snapshot,
    lost_reason      = excluded.lost_reason,
    last_interaction_at = now();

  return new;
end;
$$;

drop trigger if exists leads_sync_contact on public.leads;
create trigger leads_sync_contact
  after update on public.leads
  for each row execute function public.sync_contact_from_lead();

-- ─── 7. Profil : avatar + bio ────────────────────────────────────────────────

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio        text default '';

-- ─── 8. Activities : payload JSON ────────────────────────────────────────────

alter table public.activities
  add column if not exists payload jsonb;
