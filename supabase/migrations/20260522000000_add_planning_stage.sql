-- Ajoute le champ planning_stage au lead
-- Alimenté par le formulaire site (étape 1 : "Où en êtes-vous ?")
-- Valeurs normalisées : 'ideas' | 'planning' | 'ready'

alter table public.leads
  add column if not exists planning_stage text
    check (planning_stage in ('ideas', 'planning', 'ready'));

comment on column public.leads.planning_stage is
  'Maturité du projet voyageur : ideas = exploration, planning = projet concret, ready = prêt à réserver';
