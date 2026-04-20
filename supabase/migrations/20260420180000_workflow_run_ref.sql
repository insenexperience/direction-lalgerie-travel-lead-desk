-- Référence métier par session workflow voyageur (affichage + traçabilité).

alter table public.leads
  add column if not exists workflow_run_ref text;

comment on column public.leads.workflow_run_ref is
  'Identifiant lisible de la session workflow (ex. WF-xxxxxxxx). Null si aucune session active.';
