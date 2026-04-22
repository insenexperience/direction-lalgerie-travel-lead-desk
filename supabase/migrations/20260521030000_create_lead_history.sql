-- PRD Refonte v1 — Table lead_history (journal des transitions d'étape)
-- Dépend de : leads table (toutes migrations précédentes)

create table if not exists public.lead_history (
  id         uuid        primary key default gen_random_uuid(),
  lead_id    uuid        not null references public.leads(id) on delete cascade,
  from_stage text,
  to_stage   text        not null,
  changed_by text        not null default 'system',
  changed_at timestamptz not null default now(),
  note       text
);

create index if not exists lead_history_lead_id_idx  on public.lead_history (lead_id);
create index if not exists lead_history_changed_at_idx on public.lead_history (changed_at desc);

alter table public.lead_history enable row level security;

create policy "lead_history_select_auth"
  on public.lead_history for select
  to authenticated using (true);

create policy "lead_history_insert_auth"
  on public.lead_history for insert
  to authenticated with check (true);

-- Seuls les admins peuvent supprimer des entrées d'historique
create policy "lead_history_delete_admin"
  on public.lead_history for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
