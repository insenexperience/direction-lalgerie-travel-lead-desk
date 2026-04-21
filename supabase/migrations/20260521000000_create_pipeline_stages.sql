-- PRD Refonte v1 — Table pipeline_stages + seed
-- Dépend de : aucune migration spécifique (table autonome)

create table if not exists public.pipeline_stages (
  code        text        primary key,
  label       text        not null,
  color       text        not null,
  weight      numeric(3,2) not null check (weight >= 0 and weight <= 1),
  order_index integer     not null,
  is_closed   boolean     not null default false,
  is_won      boolean     not null default false
);

alter table public.pipeline_stages enable row level security;

create policy "pipeline_stages_select_auth"
  on public.pipeline_stages for select
  to authenticated using (true);

create policy "pipeline_stages_manage_admin"
  on public.pipeline_stages for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed : 8 étapes validées par owner (D3 de la PRD)
insert into public.pipeline_stages (code, label, color, weight, order_index, is_closed, is_won) values
  ('new',               'Nouveau',                  '#1F6FEB', 0.10, 1, false, false),
  ('qualification',     'Qualification & affinage',  '#1F6FEB', 0.30, 2, false, false),
  ('agency_assignment', 'Assignation',               '#9B7BFF', 0.30, 3, false, false),
  ('co_construction',   'Co-construction',           '#1F6FEB', 0.50, 4, false, false),
  ('quote',             'Devis',                     '#1F6FEB', 0.60, 5, false, false),
  ('negotiation',       'Négociation',               '#FF8C42', 0.80, 6, false, false),
  ('won',               'Gagné',                     '#22C55E', 1.00, 7, true,  true),
  ('lost',              'Perdu',                     '#EF4444', 0.00, 8, true,  false)
on conflict (code) do update set
  label       = excluded.label,
  color       = excluded.color,
  weight      = excluded.weight,
  order_index = excluded.order_index,
  is_closed   = excluded.is_closed,
  is_won      = excluded.is_won;
