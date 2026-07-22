-- Page voyageur de requalification (/q/<token>)
-- Spec : docs/SPEC_PAGE_VOYAGEUR_REQUALIFICATION.md
-- Additif pur : 4 colonnes nullables sur public.leads + index unique partiel sur le token.

alter table public.leads
  add column if not exists public_token uuid,
  add column if not exists public_token_expires_at timestamptz,
  add column if not exists traveler_responses jsonb,
  add column if not exists traveler_responses_submitted_at timestamptz;

create unique index if not exists leads_public_token_key
  on public.leads (public_token)
  where public_token is not null;

comment on column public.leads.public_token is
  'Token d''accès à la page voyageur /q/<token> (lu par le service role uniquement, jamais via RLS client).';
comment on column public.leads.traveler_responses is
  'Réponses structurées du voyageur (schéma versionné, cf. lib/traveler-requalification.ts).';
