-- Contacts multiples par agence + stockage logos.
-- Réf. produit : PR_BACK_OFFICE_V2 §5.3

-- ── agency_contacts ──────────────────────────────────────────────────────────

create table if not exists public.agency_contacts (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,
  is_primary        boolean not null default false,
  full_name         text not null,
  role              text,
  email             text not null default '',
  phone             text not null default '',
  whatsapp          text,
  preferred_channel text check (preferred_channel is null or preferred_channel in ('email','whatsapp','phone')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.agency_contacts is
  'Contacts d''une agence partenaire (contact principal + additionnels).';

create index if not exists agency_contacts_agency_id_idx
  on public.agency_contacts (agency_id);

-- Un seul contact principal par agence.
create unique index if not exists agency_contacts_primary_unique
  on public.agency_contacts (agency_id)
  where is_primary = true;

create trigger agency_contacts_touch_updated_at
  before update on public.agency_contacts
  for each row execute function public.touch_updated_at();

-- ── Logo columns on agencies ──────────────────────────────────────────────────

alter table public.agencies
  add column if not exists logo_storage_path text,
  add column if not exists logo_updated_at   timestamptz;

-- ── Storage bucket for agency logos ──────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agency_logos',
  'agency_logos',
  true,
  2097152,
  array['image/png','image/jpeg','image/webp','image/svg+xml']::text[]
)
on conflict (id) do update
set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── RLS on agency_contacts ────────────────────────────────────────────────────

alter table public.agency_contacts enable row level security;

create policy "agency_contacts_select_authenticated"
  on public.agency_contacts for select
  to authenticated
  using (true);

create policy "agency_contacts_insert_admin"
  on public.agency_contacts for insert
  to authenticated
  with check (public.is_app_admin());

create policy "agency_contacts_update_admin"
  on public.agency_contacts for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "agency_contacts_delete_admin"
  on public.agency_contacts for delete
  to authenticated
  using (public.is_app_admin());
