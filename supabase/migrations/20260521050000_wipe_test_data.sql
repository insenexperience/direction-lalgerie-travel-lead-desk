-- PRD Refonte v1 — Wipe des données de test
-- ⚠ IRRÉVERSIBLE — À n'appliquer qu'une seule fois, après backup
-- Backup recommandé avant exécution :
--   pg_dump --data-only --table=leads > data-backup-leads.sql
--   pg_dump --data-only --table=contacts > data-backup-contacts.sql
--
-- Cette migration supprime TOUTES les données des tables liées aux leads.
-- Les métadonnées (profiles, agencies, pipeline_stages) sont conservées.

-- Ordre respectant les FK (CASCADE gère les dépendances enfants)
-- Lead_history en premier (dépend de leads)
truncate public.lead_history            restart identity cascade;
-- Activities (dépend de leads)
truncate public.activities              restart identity cascade;
-- Quotes + items (CASCADE supprime les items)
truncate public.quotes                  restart identity cascade;
-- Proposals + consultations
truncate public.lead_circuit_proposals  restart identity cascade;
truncate public.consultations           restart identity cascade;
-- Snapshots
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='lead_snapshots') then
    truncate public.lead_snapshots restart identity cascade;
  end if;
end $$;
-- Leads (root, CASCADE vers tout le reste)
truncate public.leads                   restart identity cascade;
-- Contacts
truncate public.contacts                restart identity cascade;

-- Réinitialiser le compteur round-robin
update public.app_settings
set value = '0'::jsonb
where key = 'round_robin_referent_counter';
