-- Qualification Workspace v2 — blocs thématiques structurés.
-- Remplace la logique qualification_validation_status + champs libres
-- par 6 blocs JSONB (vibes, group, timing, stay, highlights, budget)
-- chacun avec statut IA, suggestions, confiance, et validation opérateur.

alter table public.leads
  add column if not exists qualification_blocks jsonb
    not null
    default jsonb_build_object(
      'vibes',      jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null),
      'group',      jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null),
      'timing',     jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null),
      'stay',       jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null),
      'highlights', jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null),
      'budget',     jsonb_build_object('ai_status','pending','ai_suggestions','[]'::jsonb,'ai_confidence',null,'ai_missing','[]'::jsonb,'op_selections',null,'op_action',null,'op_validated_at',null)
    );

comment on column public.leads.qualification_blocks is
  'Blocs thématiques de qualification v2. Structure : 6 blocs (vibes, group, timing, stay, highlights, budget) avec statut IA, suggestions IA, confiance, sections manquantes, sélections opérateur et validation.';

create index if not exists leads_qualification_blocks_gin_idx
  on public.leads using gin (qualification_blocks);
