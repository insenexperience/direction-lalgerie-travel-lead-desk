-- PRD v3 itération 1 : lancement du workflow (opérateur) avant premier contact voyageur structuré.

alter table public.leads
  add column if not exists workflow_launched_at timestamptz,
  add column if not exists workflow_launched_by uuid references public.profiles (id) on delete set null,
  add column if not exists workflow_mode text
    check (workflow_mode is null or workflow_mode in ('ai', 'manual'));

create index if not exists leads_workflow_launched_at_idx
  on public.leads (workflow_launched_at desc)
  where workflow_launched_at is not null;
