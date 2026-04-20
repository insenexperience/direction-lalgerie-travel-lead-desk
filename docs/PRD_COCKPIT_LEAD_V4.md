# PRD — Cockpit lead v4

**Date** : 20 avril 2026  
**Stack** : Next.js 16.2.4 App Router · React 19 · Tailwind v4 · Supabase  
**Statut** : implémenté dans le dépôt (voir migrations et `src/components/leads/lead-cockpit-*`).

## Addendum décisions (implémentation)

| Sujet | Décision |
|-------|-----------|
| Ordre des étapes pipeline | Aligné sur **`LEAD_PIPELINE`** dans [`src/lib/mock-leads.ts`](../src/lib/mock-leads.ts) : `new → qualification → agency_assignment → co_construction → quote → negotiation → won → lost` (et non l’ordre inversé co_construction / assignation du brouillon PRD initial). |
| Maquette HTML | `lead-cockpit-light-v3.html` **non fournie** ; trace : [`docs/mockups/README.md`](mockups/README.md). L’UI suit la spec textuelle + design tokens existants. |
| Date assignation référent | Colonne **`referent_assigned_at`** ajoutée ; mise à jour lors de **`claimLead`** et **`assignLeadReferent`** quand un référent est posé. |
| Fiche complète | Bloc d’édition sous **ancre** `#lead-fiche-edit` dans [`LeadCockpitDossier`](../src/components/leads/lead-cockpit-dossier.tsx) (bouton « Modifier la fiche » / `LeadEditForm`) — pas de carte séparée « Fiche complète ». |
| Suppression lead | **RLS** : uniquement admin (`leads_delete_admin`) ; l’action serveur vérifie aussi `profiles.role === 'admin'` pour un message d’erreur explicite. |
| Suppression soft vs hard | **Hard delete** conservé (aligné sur l’existant). |
| Poids score | Stockés dans `leads.scoring_weights` (JSON) ; édition réservée admin dans la modale score. |
| `toggleAiAutopilot` | Exposé comme **`toggleAiAutopilot`** dans [`ai-actions.ts`](../src/app/(dashboard)/leads/ai-actions.ts) : bascule `manual_takeover` + journal `activities.kind = 'ai_autopilot_toggle'`. |
| Hiérarchie fiche lead & contexte | **L1** : carte « étape active » (`#lead-stage-active`, [`LeadSupabaseStageWorkspace`](../src/components/leads/lead-supabase-stage-workspace.tsx)) en premier dans le contenu principal. **L2** : section « Contexte » regroupant workflow + conversation IA ([`lead-detail-supabase.tsx`](../src/app/(dashboard)/leads/[id]/lead-detail-supabase.tsx)). Bandeaux réutilisables : [`ContextBanner`](../src/components/leads/context-banner.tsx). |
| Gate Qualification → Assignation | Pas de valeur `lead_status` supplémentaire (Option B) : garde-fou serveur [`assertBriefExploitableBeforeAgencyAssignment`](../src/app/(dashboard)/leads/actions.ts) + règles [`lead-brief-gate.ts`](../src/lib/lead-brief-gate.ts) ; checklist UI en étape `qualification`. |
| CTA fiche | Encart Dossier : libellé **« Modifier la fiche »** (ancre `#lead-fiche-edit`). |
| Doc parcours (vivante) | Flux opérateur, couches d’état et conflits connus : [`USER_JOURNEYS.md`](USER_JOURNEYS.md) ; à mettre à jour avec toute évolution cockpit / pipeline / workflow (voir [`CONTRIBUTING.md`](../CONTRIBUTING.md)). |

---

## 1. Contexte et objectif

La fiche lead (`/leads/[id]`) doit offrir une **visibilité constante** sur le score, l’état IA, et un **résumé dossier** sans quitter l’étape active.

Éléments livrés : bande cockpit, pipeline horizontal cliquable, encart Dossier, bottom nav avec drawer, score paramétrable, référence `DA-YYYY-NNNN`.

## 2. Vocabulaire

- **Cockpit lead** : bande + pipeline horizontal + bottom nav (+ drawer).  
- **Étape active** : phase `lead_status` courante.  
- **Score lead** : 0–100, `coalesce(lead_score_override, lead_score)`.  
- **Encart Dossier** : résumé + actions en pied de contenu.  
- **Drawer détails** : référent, workflow, qualification.

## 3. Périmètre UI inchangé

Sidebar, header layout dashboard, nav mobile, liste/Kanban, tokens globaux `globals.css`.

## 4. Schéma données (résumé)

Colonnes ajoutées : `reference`, `lead_score`, `lead_score_override`, `lead_score_computed_at`, `referent_assigned_at`.  
Migration : [`supabase/migrations/20260430120000_lead_cockpit_v4.sql`](../supabase/migrations/20260430120000_lead_cockpit_v4.sql).

## 5. Itérations

Livraison en une passe code : migration + libs + composants cockpit + intégration fiche + workflow + docs.

---

*Document vivant — ajuster cet addendum lors des évolutions produit.*
