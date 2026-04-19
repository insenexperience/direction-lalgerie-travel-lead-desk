# Direction l'Algérie — Travel Lead Desk v2 (PRD canonique)

**Date** : 19 avril 2026  
**Stack** : Next.js App Router · Supabase (Postgres + RLS) · Tailwind · React 19  
**Agent IA** : API OpenAI — modèle configurable via `OPENAI_MODEL`  
**Canal voyageur** : WhatsApp Business API (Meta)  

**Principe** : le voyageur ne communique jamais directement avec l'agence partenaire ; Direction l'Algérie est l'interface unique. Supervision humaine obligatoire avant toute étape critique.

## 1. Canaux d'entrée

| Canal | `intake_channel` | Notes |
|--------|------------------|--------|
| Formulaire web | `web_form` | `submission_id` (idempotent), `intake_payload` |
| WhatsApp | `whatsapp` | `whatsapp_phone_number` ; webhook crée le lead si inconnu |
| Manuel | `manual` | Opérateur |
| Email | `email` | Réservé extension |

**Déclencheur conversation IA** : passage de `referent_id` de `null` à une valeur (assignation), pas la création du lead.

## 2. Flux (résumé)

1. **Qualification** — IA converse (WhatsApp) ; `conversation_transcript`, `ai_qualification_payload`, `ai_qualification_confidence`, `scoring_weights`. Opérateur valide / modifie / rejette (`qualification_validation_status`).
2. **Shortlist agences** — IA score les agences (`circuits_data`, `performance_history`, …) → `lead_circuit_proposals` avec `ai_match_score`, `ai_match_rationale`, `ai_recommended`.
3. **Envoi multi-agences** — opérateur valide et contacte ; propositions dans `agency_proposal_payload`.
4. **Comparaison** — IA score les propositions (`ai_proposal_score`, `ai_recommended`) ; opérateur arbitre.
5. **Devis DA** — devis au nom DA ; envoi voyageur (`quotes.sent_at`, `sent_via`, `pdf_storage_path`).

## 3. Schéma (référence migrations)

Les colonnes et index sont appliqués dans `supabase/migrations/` (fichier `*travel_lead_desk_v2*.sql`).  
Champs CRM retirés en v2 : `crm_feasibility_band`, `crm_primary_objection`, `crm_commercial_priority`.  
Conservés : `crm_conversion_band`, `crm_follow_up_strategy`.

Table `lead_snapshots` : supprimée (orpheline).

## 4. Variables d'environnement

Voir [`.env.example`](../.env.example) : Supabase (`NEXT_PUBLIC_*`), OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`), WhatsApp (`WHATSAPP_*`), `SUPABASE_SERVICE_ROLE_KEY` (routes webhooks uniquement, jamais exposé client).

## 5. Critères de succès et risques

Alignés sur le PRD atelier (temps de qualification, taux de remplissage, charge opérateur, délais devis).  
Mitigations : supervisor-in-the-loop, modèle configurable, reprise manuelle (`manual_takeover`), enrichissement progressif des données agences.

---

*Les détails d'implémentation (prompts, server actions, routes API) vivent dans le code (`src/lib/ai/`, `src/app/api/whatsapp/`, `src/app/(dashboard)/leads/ai-actions.ts`) et dans la doc technique [`audit-claude-pro/`](./audit-claude-pro/README.md).*
