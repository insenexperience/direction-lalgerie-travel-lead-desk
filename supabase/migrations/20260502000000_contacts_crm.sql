-- CRM/PRM — table contacts (Travelers & Seekers) + trigger de bascule automatique

create table public.contacts (
  id                    uuid primary key default gen_random_uuid(),
  type                  text not null check (type in ('traveler', 'seeker')),
  source_lead_id        uuid references public.leads (id) on delete set null,
  full_name             text not null,
  email                 text,
  phone                 text,
  whatsapp_phone_number text,
  first_seen_at         timestamptz not null default now(),
  last_interaction_at   timestamptz,
  -- Traveler
  won_at                timestamptz,
  trip_completed_at     timestamptz,
  traveler_notes        text,
  -- Seeker
  lost_at               timestamptz,
  lost_reason           text,
  -- Commun
  tags                  text[],
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index contacts_type_idx         on public.contacts (type);
create index contacts_source_lead_idx  on public.contacts (source_lead_id);

-- Unicité par email / phone (sparse : ignorer les nulls / chaînes vides)
create unique index contacts_email_unique
  on public.contacts (email)
  where email is not null and email <> '';

create unique index contacts_phone_unique
  on public.contacts (phone)
  where phone is not null and phone <> '';

-- updated_at automatique
create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.contacts enable row level security;

create policy "contacts_select_authenticated"
  on public.contacts for select
  to authenticated
  using (true);

create policy "contacts_insert_referent"
  on public.contacts for insert
  to authenticated
  with check (true);

create policy "contacts_update_admin"
  on public.contacts for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "contacts_delete_admin"
  on public.contacts for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ── Trigger : bascule automatique lead → contact à won/lost ─────────────────

create or replace function public.sync_contact_from_lead()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Déclenché seulement quand le statut change vers won ou lost
  if new.status in ('won', 'lost')
     and (old.status is distinct from new.status) then

    insert into public.contacts (
      type,
      source_lead_id,
      full_name,
      email,
      phone,
      whatsapp_phone_number,
      first_seen_at,
      won_at,
      lost_at,
      lost_reason
    ) values (
      case when new.status = 'won' then 'traveler' else 'seeker' end,
      new.id,
      coalesce(nullif(trim(new.traveler_name), ''), 'Inconnu'),
      nullif(trim(coalesce(new.email, '')), ''),
      nullif(trim(coalesce(new.phone, '')), ''),
      nullif(trim(coalesce(new.whatsapp_phone_number, '')), ''),
      new.created_at,
      case when new.status = 'won'  then now() else null end,
      case when new.status = 'lost' then now() else null end,
      case when new.status = 'lost' then nullif(trim(coalesce(new.internal_notes, '')), '') else null end
    )
    on conflict (email) where email is not null and email <> ''
    do update set
      type            = excluded.type,
      won_at          = case when excluded.type = 'traveler' then now() else contacts.won_at  end,
      lost_at         = case when excluded.type = 'seeker'   then now() else contacts.lost_at end,
      last_interaction_at = now(),
      updated_at      = now();

  end if;
  return new;
end;
$$;

create trigger on_lead_status_won_lost
  after update on public.leads
  for each row execute function public.sync_contact_from_lead();
