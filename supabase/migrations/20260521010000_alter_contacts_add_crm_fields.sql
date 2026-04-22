-- PRD Refonte v1 — Enrichissement table contacts (approche additive)
-- Dépend de : 20260502000000_contacts_crm.sql

-- Champs identité structurée
alter table public.contacts
  add column if not exists first_name       text,
  add column if not exists last_name        text,
  add column if not exists notes            text,
  add column if not exists first_lead_at    timestamptz,
  add column if not exists last_activity_at timestamptz;

-- Téléphone normalisé E.164 (séparé de phone existant pour éviter la casse)
alter table public.contacts
  add column if not exists phone_e164 text;

-- Index sparse unique sur phone_e164
create unique index if not exists contacts_phone_e164_unique
  on public.contacts (phone_e164)
  where phone_e164 is not null;

-- Remplir first_name / last_name à partir de full_name existant pour les contacts déjà créés
-- (split sur premier espace uniquement)
update public.contacts
set
  first_name = split_part(full_name, ' ', 1),
  last_name  = nullif(trim(substring(full_name from position(' ' in full_name) + 1)), '')
where full_name is not null and first_name is null;

-- Synchroniser last_activity_at avec last_interaction_at existant
update public.contacts
set last_activity_at = last_interaction_at
where last_interaction_at is not null and last_activity_at is null;
