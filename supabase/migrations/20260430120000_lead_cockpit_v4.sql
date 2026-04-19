-- PRD Cockpit lead v4 : référence humaine, score pilotable, date assignation référent.

alter table public.leads
  add column if not exists reference text,
  add column if not exists lead_score integer
    check (lead_score is null or (lead_score >= 0 and lead_score <= 100)),
  add column if not exists lead_score_override integer
    check (lead_score_override is null or (lead_score_override >= 0 and lead_score_override <= 100)),
  add column if not exists lead_score_computed_at timestamptz,
  add column if not exists referent_assigned_at timestamptz;

create unique index if not exists leads_reference_unique
  on public.leads (reference)
  where reference is not null;

-- Références pour les leads existants : DA-YYYY-NNNN par année de created_at.
with numbered as (
  select
    id,
    'DA-' || to_char(created_at, 'YYYY') || '-' || lpad(
      row_number() over (
        partition by (date_trunc('year', created_at))
        order by created_at
      )::text,
      4,
      '0'
    ) as ref
  from public.leads
  where reference is null
)
update public.leads l
set reference = n.ref
from numbered n
where l.id = n.id;
