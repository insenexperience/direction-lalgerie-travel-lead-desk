-- Qualification = affinage (une seule étape pipeline). Anciens leads « refinement » → « qualification ».
-- Grille CRM express sur public.leads (priorité, conversion, faisabilité, relance, objection optionnelle).

update public.leads
set status = 'qualification'::public.lead_status
where status = 'refinement'::public.lead_status;

do $crm_enums$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'crm_commercial_priority'
  ) then
    create type public.crm_commercial_priority as enum ('low', 'medium', 'high', 'critical');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'crm_conversion_band'
  ) then
    create type public.crm_conversion_band as enum ('low', 'medium', 'high');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'crm_feasibility_band'
  ) then
    create type public.crm_feasibility_band as enum ('unlikely', 'possible', 'likely', 'clear');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'crm_follow_up_strategy'
  ) then
    create type public.crm_follow_up_strategy as enum ('nurture', 'push', 'pause', 'escalate', 'none');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'crm_primary_objection'
  ) then
    create type public.crm_primary_objection as enum (
      'none',
      'price',
      'timing',
      'hesitation',
      'confidence',
      'other'
    );
  end if;
end
$crm_enums$;

alter table public.leads
  add column if not exists crm_commercial_priority public.crm_commercial_priority not null default 'medium',
  add column if not exists crm_conversion_band public.crm_conversion_band not null default 'medium',
  add column if not exists crm_feasibility_band public.crm_feasibility_band not null default 'possible',
  add column if not exists crm_follow_up_strategy public.crm_follow_up_strategy not null default 'none',
  add column if not exists crm_primary_objection public.crm_primary_objection not null default 'none';
