# Données Supabase (Postgres + RLS)

**Source de vérité** : fichiers SQL dans [`supabase/migrations/`](../../supabase/migrations/). Ce document résume l’intention du schéma.

## Schéma initial (cœur métier)

Fichier : [`20260418120000_initial_core.sql`](../../supabase/migrations/20260418120000_initial_core.sql).

### Enums principaux (extraits)

- `app_role` : `admin`, `lead_referent`.
- `lead_status` : à l’origine inclut `refinement` ; après `20260427120000` la valeur **`refinement` est retirée** au profit de **`qualification`** (voir section migrations). Valeurs finales : `new`, `qualification`, `agency_assignment`, `co_construction`, `quote`, `negotiation`, `won`, `lost`.
- `partner_agency_type`, `partner_agency_status`, `agency_consultation_status`, `quote_kind`.

### Tables principales

| Table | Rôle |
|-------|------|
| `profiles` | Profil app lié à `auth.users` (rôle, nom, etc.). |
| `agencies` | Agences partenaires (coordonnées, SLA, statut). |
| `leads` | Dossiers voyageurs / pipeline / référent / agence retenue. |
| `consultations` | Lien lead ↔ agence (statut de consultation). |
| `quotes` | Devis (lien lead, consultation optionnelle, type DA vs agence). |
| `activities` | Journal d’événements sur un lead. |

`lead_snapshots` existait dans la migration initiale puis a été **supprimée** dans la migration v2 (`20260428100000_travel_lead_desk_v2.sql`, `drop table … lead_snapshots`).

### RLS (évolution)

La migration initiale active RLS avec des politiques **permissives pour `authenticated`** sur la plupart des tables (commentaire : à remplacer par une matrice référent / admin — voir spec produit).

Des migrations ultérieures resserrent les règles (pool de lecture, admin vs référent).

## Migrations ultérieures (ordre chronologique des fichiers)

| Fichier | Intention |
|---------|-----------|
| [`20260419140000_leads_intake_columns.sql`](../../supabase/migrations/20260419140000_leads_intake_columns.sql) | Colonnes d’intake alignées sur le site public (`submission_id`, `intake_payload`, `page_origin`, index unique partiel). |
| [`20260420100000_leads_rls_select_pool.sql`](../../supabase/migrations/20260420100000_leads_rls_select_pool.sql) | Politique SELECT : tout `authenticated` peut lire tous les leads (pool d’assignation). |
| [`20260421120000_co_construction_proposals.sql`](../../supabase/migrations/20260421120000_co_construction_proposals.sql) | Table `lead_circuit_proposals` + enum de statut (co-construction → devis). |
| [`20260422120000_quotes_workflow_items.sql`](../../supabase/migrations/20260422120000_quotes_workflow_items.sql) | Workflow devis (`quote_workflow_status`) + lignes structurées pour PDF / UI. |
| [`20260423140000_rls_admin_vs_referent_v1.sql`](../../supabase/migrations/20260423140000_rls_admin_vs_referent_v1.sql) | RLS v1 : admin full access ; référent sur pool + ses dossiers ; fonctions helper (`is_app_admin`, `lead_is_visible_for_rls`, …) ; tables liées au périmètre du lead. |
| [`20260423150000_profiles_email_display.sql`](../../supabase/migrations/20260423150000_profiles_email_display.sql) | Colonne `email` sur `profiles`, sync depuis `auth.users`, trigger `handle_new_user` enrichi pour libellés. |
| [`20260427120000_qualification_merge_crm.sql`](../../supabase/migrations/20260427120000_qualification_merge_crm.sql) | Fusion qualification / affinage (`refinement` → `qualification`) ; enums et colonnes CRM express sur `leads`. |
| [`20260428100000_travel_lead_desk_v2.sql`](../../supabase/migrations/20260428100000_travel_lead_desk_v2.sql) | Colonnes v2 sur `leads` (canal intake, WhatsApp, transcript, payload IA qualification, validation superviseur, etc.), enrichissement `lead_circuit_proposals` / `agencies` / `quotes`, index, **drop** `lead_snapshots`. |
| [`20260428120000_quote_pdfs_bucket.sql`](../../supabase/migrations/20260428120000_quote_pdfs_bucket.sql) | Bucket Storage **`quote_pdfs`** (privé, PDF uniquement, 50 Mo max) pour déposer les PDF et servir via URL signée côté serveur. |
| [`20260429100000_lead_workflow_v3_iter1.sql`](../../supabase/migrations/20260429100000_lead_workflow_v3_iter1.sql) | Lancement workflow opérateur : `workflow_launched_at`, `workflow_launched_by`, `workflow_mode` (`ai` \| `manual`). |

### Rappel enum `lead_status` (schéma initial puis merge)

Valeurs d’origine dans `20260418120000_initial_core.sql` : `new`, `qualification`, `refinement`, `agency_assignment`, `co_construction`, `quote`, `negotiation`, `won`, `lost`. Après `20260427120000`, la valeur **`refinement` disparaît** au profit de **`qualification`** (données migrées dans la migration).

## Seed & utilitaires

- [`supabase/seed.sql`](../../supabase/seed.sql) — données de dev si utilisé.
- [`supabase/scripts/clear_demo_data.sql`](../../supabase/scripts/clear_demo_data.sql) — nettoyage démo.

## Audit suggéré côté base

- Vérifier **cohérence** entre politiques `20260420100000` (select all) et `20260423140000` (restrictions) sur `leads` (combinaison PERMISSIVE / USING).
- Parcourir les **policies** sur `quotes`, `consultations`, `lead_circuit_proposals` après la v1 RLS.
- Valider les triggers **`handle_new_user`** (dernière version dans la dernière migration qui les remplace).
- **Storage** : la migration `20260428120000` crée seulement le bucket `quote_pdfs` ; vérifier en prod les **policies** sur `storage.objects` pour ce bucket (souvent hors migrations ou à ajouter) — accès typiquement service role + URLs signées.
