# Back office v3 : où vivent les données

Refonte du back office d'après le handoff Claude Design (`back office/refonte-v2/design_handoff_back_office`, décisions D1–D10 validées le 26/09/2026).

Le principe : **aucune migration de schéma pour le parcours**. Les écrans v3 lisent et écrivent les tables existantes ; ce qui n'avait pas de colonne vit dans des colonnes JSON déjà présentes. Seules migrations ajoutées : deux correctifs des déclencheurs de clôture (voir « Pièges connus »).

## Code

| Zone | Rôle |
|------|------|
| `src/lib/bo3/types.ts` | Types du domaine : `Statut`, `Trame`, `Consultation`, `DevisDA`, `Projet`… |
| `src/lib/bo3/load.ts` | Lecture : lignes Supabase → `Projet` (statut affiché, trame, consultations, proposition DA, fil). Lecture par pages de 1 000 (plafond silencieux de PostgREST), identifiants par paquets de 150 ; une erreur arrête la page (`src/app/error.tsx`) au lieu d'afficher des dossiers incomplets. |
| `src/lib/bo3/projet.ts` | Règles pures : horloges 48 h, ce qui manque, prochaine action, routage par zone, brief, contrôle anti-fuite. |
| `src/lib/bo3/trame.ts` | Trame du site (contrat v1) → trame du back office ; vocabulaire commun (mois, budgets, groupes). |
| `src/lib/bo3/champs-voyageur.ts` | Formulaire voyageur raccourci : lecture sûre des réponses, fusion dans la trame. |
| `src/app/(dashboard)/leads/projet-actions.ts` | Toutes les écritures de la fiche projet (actions serveur). |
| `src/components/bo3/` | Écrans : coque, file de travail, projets, fiche, pilotage, agences. |
| `src/styles/bo3.css` | Généré par `scripts/generer-bo3-css.mjs` depuis le CSS du prototype, limité à `.bo3`. Ne pas éditer à la main. |

## Les 7 étapes affichées

Elles sont **dérivées** de `leads.status` (enum inchangé) et du contenu du dossier, dans `statutDe()` (`load.ts`) :

| Étape affichée | Condition |
|----------------|-----------|
| À compléter | `new` / `qualification` / `refinement`, et pas de trame ou il manque dates, groupe, budget ou lieux |
| Reçu | mêmes statuts, trame complète |
| Brief prêt | `agency_assignment`, aucune agence consultée |
| Envoyé aux agences | `agency_assignment`, au moins une consultation |
| Proposition | `co_construction` |
| Proposée | `quote` / `negotiation` |
| Clos | `won` / `lost` |

Transitions écrites par les actions (toujours conditionnées au statut de départ, pour ne jamais reculer un dossier) :

- `genererBrief`, `envoyerBrief` : `new|qualification|refinement` → `agency_assignment`
- `saisirProposition`, `retenirProposition`, `convertirProposition` : `agency_assignment` → `co_construction`
- `envoyerProposition` : `co_construction|agency_assignment` → `quote`
- `marquerGagne` / `marquerPerdu` : → `won` / `lost` (+ `closed_at`)

## Les deux horloges de 48 h

- **Voyageur** : de `leads.created_at` à la première réponse = première activité `first_response` ou `traveler_link_sent` (à défaut `welcome_email_sent_at`). Envoyer le lien voyageur vaut première réponse.
- **Agence** : de `lead_circuit_proposals.brief_sent_at` à `proposal_received_at` (ou `proposal_declined_at`).

Calcul dans `clockState()` / `agencyClock()` (`projet.ts`), fuseau Africa/Algiers.

## Où est rangé quoi

| Donnée | Emplacement |
|--------|-------------|
| Trame envoyée par le site | `leads.intake_payload.trame` (contrat v1, ≤ 60 000 caractères, `intake-lead-insert.ts`) |
| Trame construite ou complétée dans le back office | `leads.ai_qualification_payload.trame_v3` — prioritaire sur celle du site |
| Colonnes historiques (listes, recherche) | `leads.budget`, `trip_dates`, `travelers`, tenues à jour par `colonnesDepuisTrame()` |
| Brief | `leads.generated_brief` (markdown), `brief_generated_at`, `brief_edited_at` |
| Une agence consultée | une ligne `lead_circuit_proposals` (`brief_sent_at` non nul) |
| Accusé, relances, portion du trajet, écarts | `lead_circuit_proposals.agency_proposal_payload` : `acknowledged_at`, `reminders[]`, `portion`, `ecarts` |
| Proposition d'agence | `proposal_received_at`, `agency_proposal_price`, `agency_proposal_duration_days`, `agency_proposal_summary` |
| Proposition retenue | `lead_circuit_proposals.status = approved`, `leads.retained_agency_id` |
| Proposition Direction l'Algérie | `quotes` (`kind = da_traveler`), `items` = `{ v: 3, titre, lignes[], prix, validite, note, mention, agence_id, proposition_id }` |
| Envoi au voyageur | `quotes.sent_at`, `sent_via` (`whatsapp` / `email` / `manual` seulement : contrainte `quotes_sent_via_check`) |
| Fil du dossier (messages, jalons) | `activities`, `payload = { k, s, b }` ; `kind` ∈ `first_response`, `traveler_link_sent`, `traveler_answers`, `traveler_reminder`, `ack_sent`, `brief_sent`, `agency_proposal`, `quote_converted`, `quote_sent`, `won`, `lost` |
| Motif de perte | activité `lost`, `payload.motif`, et `contacts.lost_reason` de la fiche contact |

## PDF de la proposition

`GET /api/leads/[leadId]/quotes/[quoteId]/pdf` et l'envoi WhatsApp (`quote-actions.ts`) passent par `buildQuoteDevisPdfBuffer`. Si `quotes.items` est l'objet v3, le PDF est la « Proposition de voyage » : titre, lignes, prix par personne, validité, « paiement hors plateforme », mention du partenariat selon `mention` (`visible`, `discrete`, `aucune` : rien). Sinon, l'ancien « Devis voyage » en tableau. Le logo est embarqué (`src/lib/pdf/logo-da.ts`) : l'image Squarespace n'était pas acceptée par react-pdf.

## Lien voyageur raccourci

`demanderManque` crée `public_token` (30 jours) et un lien `/q/<token>?champs=dates,groupe,budget,lieux` limité à ce qui manque. Avec `champs`, la page affiche le formulaire court (`champs-form.tsx`) et poste sur `POST /api/q/<token>/champs`, qui :

- n'accepte que les champs demandés **et encore manquants** (une adresse retouchée ne peut pas écraser une saisie de l'opérateur), et les valeurs du vocabulaire (`422` sinon) ; la page fait le même calcul et ne pose que ces questions. Si plus rien ne manque, elle ne propose qu'un message libre (« Votre projet est complet ») ;
- refuse un dossier clos ou supprimé (`410`, page « Ce lien n'est plus actif ») ;
- fusionne dans `trame_v3` ; des lieux choisis alors qu'un itinéraire existe vont dans « points à ajuster », sans l'écraser ;
- marque `traveler_responses_submitted_at` par une écriture conditionnelle (`409` au second envoi, même depuis deux onglets) et ajoute une activité `traveler_answers`.

Sans `champs`, `/q/<token>` reste le questionnaire long d'origine (leads WhatsApp peu qualifiés).

## Variables d'environnement

| Variable | Effet |
|----------|-------|
| `TRAVELER_ACK_ENABLED=1` | Accusé de réception envoyé au voyageur à l'arrivée du projet. **Laisser à 0** tant que `contact@directionlalgerie.com` n'est pas rétabli (abonnement Workspace). |
| `BO3_APERCU_LOCAL=1` | Aperçu sans connexion, **en développement seulement** (`apercuLocalActif()`). Sans effet en production. |
| `CRON_SECRET` | Protège `/api/cron/keepalive` (base Supabase gardée éveillée). |

## Pièges connus : le passage en gagné ou perdu

Le déclencheur `leads_sync_contact` (migration v5.1) est resté actif alors que `trg_lead_close_sync_contact` l'a remplacé. Son `on conflict (source_lead_id)` ne correspond pas à l'index partiel `contacts_source_lead_unique`, et Postgres refuse toute mise à jour vers `won` ou `lost` (erreur 42P10). Aucun dossier n'a pu être clos avant ce correctif. Migration : `supabase/migrations/20260927100000_drop_duplicate_contact_sync_trigger.sql` (appliquée le 28/09).

Le déclencheur restant, `trg_lead_close_sync_contact`, ne retrouvait la fiche contact que par e-mail. Un voyageur revenu avec une autre adresse mais le même téléphone (ou deux voyageurs d'un même foyer) heurtait `contacts_phone_unique` : la clôture échouait. Correctif : rapprochement par e-mail (sans la casse), puis par téléphone, puis par lead d'origine ; sinon création, qui ne peut plus échouer sur un conflit. Migration : `supabase/migrations/20260928100000_contact_sync_match_phone.sql`, essayée sur la base de production dans une transaction annulée.

## Tester

Le CRM local lit la base de **production** : nommer les leads de test « TEST … » et les supprimer ensuite.

- `next dev` : Turbopack casse sur les polices Google, utiliser `--webpack`.
- `scripts/bo3/tester-parcours.mjs <leadId>` joue le parcours opérateur dans Chrome sans tête, sur `http://127.0.0.1:3010`. En `next dev`, les pages ne s'hydratent pas dans Chrome sans tête (socket HMR refusé) : il faut un build de production local (`next build --webpack`, `next start -p 3010`). L'aperçu sans connexion y est volontairement coupé ; pour ce test, on l'autorise par une modification locale de `apercuLocalActif()` qui ne doit jamais être commitée.
