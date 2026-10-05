# Back office v3 : où vivent les données

Refonte du back office d'après le handoff Claude Design (`back office/refonte-v2/design_handoff_back_office`, décisions D1–D10 validées le 26/09/2026).

Le parcours conserve l'enum des leads et les colonnes JSON existantes pour la trame et les faits de qualification. Depuis le 05/10/2026, le mailing ajoute une table dédiée `lead_email_messages` pour les brouillons, versions relues et envois ; trois migrations décrites plus bas assurent persistance, concurrence et journal BO3. Les correctifs des déclencheurs de clôture restent nécessaires (voir « Pièges connus »).

## Code

| Zone | Rôle |
|------|------|
| `src/lib/bo3/types.ts` | Types du domaine : `Statut`, `Trame`, `Consultation`, `DevisDA`, `Projet`… |
| `src/lib/bo3/load.ts` | Lecture : lignes Supabase → `Projet` (statut affiché, trame, consultations, proposition DA, fil). Lecture par pages de 1 000 (plafond silencieux de PostgREST), identifiants par paquets de 150 ; une erreur arrête la page (`src/app/error.tsx`) au lieu d'afficher des dossiers incomplets. |
| `src/lib/bo3/projet.ts` | Règles pures : horloges 48 h, ce qui manque, prochaine action, routage par zone, brief, contrôle anti-fuite. |
| `src/lib/bo3/trame.ts` | Trame du site (contrat v1) → trame du back office ; vocabulaire commun (mois, budgets, groupes). |
| `src/lib/bo3/champs-voyageur.ts` | Formulaire voyageur raccourci : lecture sûre des réponses, fusion dans la trame. |
| `src/app/(dashboard)/leads/projet-actions.ts` | Écritures BO3 : trame, génération du brief, préparation de consultation, propositions et clôture (actions serveur). |
| `src/lib/manual-lead-import.ts`, `src/app/(dashboard)/leads/manual-import-actions.ts` | Analyse du message, draft de qualification éditable, retranscription fidèle, source originale conservée et création avec référent explicite. |
| `src/lib/lead-qualification-completeness.ts` | Moteur déterministe partagé : questions manquantes et `readyForAgencyBrief`, à partir des faits confirmés, réponses voyageur et trame. |
| `src/app/(dashboard)/leads/qualification-details-actions.ts` | Enregistrement des réponses/logistique dans les faits de qualification et colonnes du dossier. |
| `src/lib/email/lead-email-template.ts`, `src/components/leads/lead-email-composer.tsx`, `src/app/(dashboard)/leads/email-actions.ts` | Templates DA, texte éditable, aperçu HTML, copie/export, brouillons, envoi explicite Resend ou déclaration externe et historique. |
| `src/components/bo3/` | Écrans : coque, file de travail, projets, fiche, pilotage, agences. |
| `src/styles/bo3.css` | Généré par `scripts/generer-bo3-css.mjs` depuis le CSS du prototype, limité à `.bo3`. Ne pas éditer à la main. |

## Les 7 étapes affichées

Elles sont **dérivées** de `leads.status` (enum inchangé) et du contenu du dossier, dans `statutDe()` (`load.ts`) :

| Étape affichée | Condition |
|----------------|-----------|
| À compléter | `new` / `qualification` / `refinement` et informations indispensables au brief incomplètes selon `analyzeLeadQualification` |
| Reçu | mêmes statuts, informations indispensables complètes, avec ou sans trame du site |
| Brief prêt | `agency_assignment`, aucun brief agence envoyé ; les consultations `pending_send` restent à cette étape |
| Envoyé aux agences | `agency_assignment`, au moins une consultation avec `brief_sent_at` non nul |
| Proposition | `co_construction` |
| Proposée | `quote` / `negotiation` |
| Clos | `won` / `lost` |

Transitions écrites par les actions (toujours conditionnées au statut de départ, pour ne jamais reculer un dossier) :

- `genererBrief`, `preparerEmailAgence` : `new|qualification|refinement` → `agency_assignment`. La préparation de consultation n'enregistre aucun envoi : `status = pending_send`, `brief_sent_at = null`.
- `finalize_lead_email_message` : après un envoi client `welcome` ou `qualification`, `new` → `qualification` ; après un mail `agency_brief`, la consultation passe à `awaiting_response` et reçoit `brief_sent_at`. Un envoi externe déclaré suit ces mêmes indicateurs, avec sa provenance distincte.
- `saisirProposition`, `retenirProposition`, `convertirProposition` : `agency_assignment` → `co_construction`
- `envoyerProposition` : `co_construction|agency_assignment` → `quote`
- `marquerGagne` / `marquerPerdu` : → `won` / `lost` (+ `closed_at`)

Le bouton historique de la fiche qui appelait `envoyerBrief` pour déclarer immédiatement le brief envoyé est remplacé par « Préparer l'email ». « Confier à une agence » prépare la consultation et ouvre son composer ; l'horloge et l'étape d'envoi ne changent qu'après transmission explicite ou déclaration externe.

## Import manuel et qualification fidèle

L'import accepte un message complet, jusqu'à 40 000 caractères. L'analyse propose les coordonnées, le titre, destinations/options, groupe, dates/période, hébergement, budget, vols, chambres, contraintes et langue du message. L'opérateur relit et corrige ces champs et la retranscription complète dans les notes supplémentaires avant de confirmer la création. L'analyse seule ne crée rien et n'envoie rien ; en l'absence d'IA, un fallback conservateur garde les faits explicitement reconnaissables et signale la relecture nécessaire.

`createLeadFromManualMessage` affecte explicitement le dossier à l'utilisateur connecté. La source originale reste inchangée dans `intake_payload.source_message`, indépendamment des notes reformatées (`project_description` / `intake_payload.notes_longues`). Les sections, options de parcours, distances déclarées, expérience et questions d'autorisations/faisabilité doivent rester fidèles ; une question du voyageur ne devient pas une autorisation confirmée. L'onglet Voyageur donne accès aux notes et au message original.

Les inconnues ne sont pas comblées par les défauts historiques : une année absente reste à demander ; « entre amis » ne prouve aucun nombre ; un total de participants ne prouve pas leur répartition adultes/enfants. La devise et la base du budget restent inconnues si elles ne sont pas déclarées. Les devises étrangères sont conservées dans les faits et le texte, sans conversion inventée dans les colonnes financières contraintes à EUR. Un UUID `submission_id` existant empêche de réimporter le même identifiant.

### Informations nécessaires au brief

`analyzeLeadQualification` alimente le pourcentage de complétude, le composer et le garde-fou serveur de génération/envoi. La validation de chips ou un budget « À définir avec l'agence » ne suffit pas. La présence d'une trame du site n'est pas requise si la fiche qualifiée contient déjà les informations nécessaires.

- Vols : besoin d'une proposition avec vols, réservation gérée par le client ou vols déjà réservés ; aéroport de départ si une proposition avec vols est demandée.
- Groupe : nombre total cohérent, adultes/enfants et âge de chaque enfant au départ. Une composition explicitement saisie prime sur une valeur historique ; les défauts 1 adulte/0 enfant ne sont pas des réponses.
- Hébergement : type/confort et nombre de chambres par type avec une capacité cohérente avec le groupe. Une simple mention « deux chambres » ne suffit pas ; bivouac seul ou expédition pédestre adapte les questions plutôt que de demander des chambres d'hôtel.
- Dates : période avec année et durée/flexibilité. L'année de réception du message n'est jamais utilisée pour compléter des dates ambiguës.
- Budget : montant/fourchette, devise, par personne ou pour le groupe, et périmètre incluant ou excluant les vols.
- Parcours : régions, étapes ou demande explicite d'un itinéraire à proposer. Une expédition ajoute stratégie d'eau/autonomie et couchage/matériel.

Arrivée/départ en Algérie, prestations et besoins particuliers peuvent rester des points complémentaires à confirmer, visibles dans le brief. Les réponses sont enregistrées via la fiche logistique ; le composer peut ensuite régénérer ses questions en demandant confirmation avant de remplacer un texte déjà édité.

## Mailing dans la chaîne BO3

« Écrire la première réponse » et « Ouvrir le brouillon » ouvrent le modèle `welcome`. Qualification expose `qualification` et la fiche logistique. Chaque consultation dispose de son `agency_brief`. Les modèles utilisent le logo et la mise en page Direction l'Algérie ; les emails client sont en français ou anglais, selon la langue originale enregistrée et le choix de l'opérateur. Le brief agence reste en français.

L'objet et le texte sont éditables. L'aperçu, la copie de l'email mis en forme, du texte ou du HTML, le téléchargement HTML et l'envoi reprennent le texte édité. Le HTML est rendu avec échappement du texte de l'opérateur. Le brief conserve les notes détaillées et les données confirmées, en masquant noms, coordonnées et profils sociaux ; le serveur refuse la réintroduction de données personnelles dans un mail agence édité.

La sauvegarde crée/met à jour un `draft` persistant. Le lancement du workflow IA ou manuel ne déclenche plus de mail : le référent ou un administrateur doit utiliser **Envoyer depuis Travel Lead** pour appeler Resend, ou confirmer **J'ai envoyé depuis ma messagerie** après un envoi externe. Un dossier non assigné, archivé, un destinataire invalide, une consultation incohérente ou un brief agence incomplet bloque les actions concernées. BO3 prend les dossiers de pool lors d'une action opérateur ; l'import manuel attribue directement le référent.

L'historique distingue `draft`, `sending`, `sent`, `failed` et `external`. Le contenu d'un message traité est immuable ; un nouvel envoi se prépare dans un nouveau brouillon. Sauvegarde, claim d'envoi et finalisation contrôlent `updated_at` pour refuser une version modifiée entre-temps. Si la confirmation du prestataire est incertaine, le message reste `sending` et son état doit être vérifié avant tout renvoi.

### Migrations mailing

Appliquer ces trois fichiers dans l'ordre :

1. `20261005140000_lead_email_messages.sql` : table des mails, RLS pour les dossiers visibles et mutations du référent/admin, protection de l'historique et RPC de finalisation.
2. `20261005143000_lead_email_concurrency.sql` : contrôle de la révision attendue lors de la finalisation.
3. `20261005150000_lead_email_bo3_journal.sql` : même finalisation atomique avec journal BO3 et progression client/agence.
4. `20261005152000_lead_email_delivery_guard.sql` : une seule transmission en cours par dossier/type/agence ; les envois incertains bloquent une nouvelle transmission jusqu’à vérification.
5. `20261005153000_lead_email_consultation_guard.sql` : deux préparations simultanées réutilisent la même consultation du module mailing.

Un email complémentaire à une agence conserve le statut et la date du premier brief de sa consultation.

La RPC `finalize_lead_email_message` enregistre le résultat et l'activité `email_sent` / `email_sent_externally` avec `payload = { k:'out', s, b, email_kind, email_id, delivery }`. Un mail client finalisé peut arrêter l'horloge de première réponse ; un mail agence finalisé démarre l'horloge agence. Copier, exporter ou enregistrer un brouillon ne déclare aucun envoi.

## Les deux horloges de 48 h

- **Voyageur** : de `leads.created_at` à la première activité `first_response`, `traveler_link_sent`, ou `email_sent` / `email_sent_externally` dont `payload.email_kind` vaut `welcome` ou `qualification` (à défaut `welcome_email_sent_at`). L'accusé automatique `ack_sent` du site ne compte pas comme réponse humaine.
- **Agence** : de `lead_circuit_proposals.brief_sent_at` à `proposal_received_at` (ou `proposal_declined_at`). Une consultation `pending_send` n'a aucune horloge, aucun accusé attendu, aucune relance ni chiffrage à saisir avant l'envoi.

Calcul dans `clockState()` / `agencyClock()` (`projet.ts`), fuseau Africa/Algiers.

## Où est rangé quoi

| Donnée | Emplacement |
|--------|-------------|
| Trame envoyée par le site | `leads.intake_payload.trame` (contrat v1, ≤ 60 000 caractères, `intake-lead-insert.ts`) |
| Trame construite ou complétée dans le back office | `leads.ai_qualification_payload.trame_v3` — prioritaire sur celle du site |
| Message importé original | `leads.intake_payload.source_message` ; conservé distinct des notes reformatées |
| Analyse manuelle relue et langue client | `intake_payload.manual_qualification`, `import_mode = manual_message`, `language = fr/en`, `unknown_fields` ; référent explicitement affecté à la création |
| Notes supplémentaires du voyage | `leads.project_description`, `intake_payload.notes_longues` ; reprise anonymisée dans le brief |
| Réponses et faits logistiques confirmés | `intake_payload.qualification_facts` : vols, composition/âges, chambres, dates/durée, budget/devise/base/périmètre, hébergement, parcours, prestations, contraintes et expédition ; les réponses voyageur et la trame alimentent aussi le moteur |
| Colonnes historiques (listes, recherche) | `leads.budget`, `trip_dates`, `travelers`, tenues à jour par `colonnesDepuisTrame()` |
| Brief | `leads.generated_brief` (markdown), `brief_generated_at`, `brief_edited_at` |
| Consultation en préparation | une ligne `lead_circuit_proposals`, `status = pending_send`, `brief_sent_at = null` ; visible en BO3 comme brouillon |
| Une agence consultée | même ligne après envoi finalisé : `brief_sent_at` non nul, `status = awaiting_response` |
| Brouillons et historique des mails | `lead_email_messages` : dossier, agence/consultation éventuelles, destinataire, objet, texte et HTML, langue, version du template, informations manquantes, statut, prestataire/auteur/date d'envoi |
| Accusé, relances, portion du trajet, écarts | `lead_circuit_proposals.agency_proposal_payload` : `acknowledged_at`, `reminders[]`, `portion`, `ecarts` |
| Proposition d'agence | `proposal_received_at`, `agency_proposal_price`, `agency_proposal_duration_days`, `agency_proposal_summary` |
| Proposition retenue | `lead_circuit_proposals.status = approved`, `leads.retained_agency_id` |
| Proposition Direction l'Algérie | `quotes` (`kind = da_traveler`), `items` = `{ v: 3, titre, lignes[], prix, validite, note, mention, agence_id, proposition_id }` |
| Envoi au voyageur | `quotes.sent_at`, `sent_via` (`whatsapp` / `email` / `manual` seulement : contrainte `quotes_sent_via_check`) |
| Fil du dossier (messages, jalons) | `activities`, `payload = { k, s, b }` ; événements historiques et `email_sent` / `email_sent_externally` ajoutés par la RPC, avec `email_kind`, `email_id`, `delivery` |
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
| `TRAVELER_ACK_ENABLED=1` | Accusé automatique historique du site uniquement, journalisé `ack_sent` ; indépendant du composer opérateur et de l'horloge de première réponse humaine. Valeur par défaut : 0. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Nécessaires à l'envoi explicite depuis le composer. Sans configuration, copie/export et déclaration d'un envoi externe restent disponibles. |
| `BO3_APERCU_LOCAL=1` | Aperçu sans connexion, **en développement seulement** (`apercuLocalActif()`). Sans effet en production. |
| `CRON_SECRET` | Protège `/api/cron/keepalive` (base Supabase gardée éveillée). |

## Pièges connus : le passage en gagné ou perdu

Le déclencheur `leads_sync_contact` (migration v5.1) est resté actif alors que `trg_lead_close_sync_contact` l'a remplacé. Son `on conflict (source_lead_id)` ne correspond pas à l'index partiel `contacts_source_lead_unique`, et Postgres refuse toute mise à jour vers `won` ou `lost` (erreur 42P10). Aucun dossier n'a pu être clos avant ce correctif. Migration : `supabase/migrations/20260927100000_drop_duplicate_contact_sync_trigger.sql` (appliquée le 28/09).

Le déclencheur restant, `trg_lead_close_sync_contact`, ne retrouvait la fiche contact que par e-mail. Un voyageur revenu avec une autre adresse mais le même téléphone (ou deux voyageurs d'un même foyer) heurtait `contacts_phone_unique` : la clôture échouait. Correctif : rapprochement par e-mail (sans la casse), puis par téléphone, puis par lead d'origine ; sinon création, qui ne peut plus échouer sur un conflit. Migration : `supabase/migrations/20260928100000_contact_sync_match_phone.sql`, essayée sur la base de production dans une transaction annulée.

## Tester

Le CRM local lit la base de **production** : nommer les leads de test « TEST … » et les supprimer ensuite.

- `next dev` : Turbopack casse sur les polices Google, utiliser `--webpack`.
- `scripts/bo3/tester-parcours.mjs <leadId>` joue le parcours opérateur dans Chrome sans tête, sur `http://127.0.0.1:3010`. En `next dev`, les pages ne s'hydratent pas dans Chrome sans tête (socket HMR refusé) : il faut un build de production local (`next build --webpack`, `next start -p 3010`). L'aperçu sans connexion y est volontairement coupé ; pour ce test, on l'autorise par une modification locale de `apercuLocalActif()` qui ne doit jamais être commitée.
- Ce script historique ne couvre pas le composer et ses envois : vérifier séparément import/relecture, sauvegarde et rechargement du brouillon, copie/export, consultation `pending_send`, questions adaptatives et refus des informations manquantes. Aucun envoi ni déclaration externe ne doit être simulé sur un vrai dossier client.
- Tests purs sans réseau : `node tests/manual-lead-import.test.cjs` (source, champs inconnus, devise et édition), `node tests/agency-email-notes.test.cjs` (détails du brief, anonymisation et langue), et tests de qualification dans `src/lib/lead-qualification-completeness.test.ts`.
