# Direction l'Algérie — Document central du projet

**Version** : 2026.2 (avril 2026)
**Statut** : document vivant, source de vérité projet
**Maintenance** : INSEN Studio
**Public** : équipe projet, partenaires opérationnels, contributeurs IA (Claude, Cursor, Claude Code)

**Changelog**

- **v2026.2** — intégration d'Authentic Algeria (projet INSEN sœur, authenticalgeria.com) comme troisième canal d'entrée structurel des leads. Mise à jour du schéma d'architecture, de la stack technique, de la section « canaux d'entrée », de l'état réel et des priorités de coordination. Ajout des entrées de glossaire correspondantes.
- **v2026.1** — première consolidation (fusion du document officiel de présentation et de la documentation produit du dépôt Travel Lead Desk).

---

## 0. À propos de ce document

Ce document consolide en un seul lieu la **vision, l'architecture, l'état réel et la trajectoire** de Direction l'Algérie. Il fusionne trois sources :

- **Le document officiel de présentation** (vision macro, façade publique, série documentaire, modèle de plateforme).
- **La documentation produit du dépôt Travel Lead Desk** (PRD v2, spec UX, cockpit lead v4, schéma Supabase, prompts IA, routes).
- **Le Hub Notion INSEN** (organisation interne, Hub Direction l'Algérie et Hub Authentic Algeria — projet sœur et source de leads qualifiés).

Il s'adresse à toute personne qui doit comprendre le projet **dans son ensemble** — pas seulement le site public, pas seulement l'app interne, mais le système complet et la manière dont les deux moitiés se branchent.

En cas de divergence avec un document plus spécifique :
- Pour la **roadmap produit du back-office** → `docs/PRD_TRAVEL_LEAD_DESK_V2.md` prime.
- Pour les **règles UX détaillées** → `docs/PRODUCT_SPEC.md` prime.
- Pour les **détails UI du cockpit lead** → `docs/PRD_COCKPIT_LEAD_V4.md` prime.
- Pour la **vision macro et l'éditorial public** → ce document est la source.

---

## 1. Le projet en une phrase

Direction l'Algérie est une **plateforme média et touristique** qui raconte l'Algérie avec exigence, structure l'exploration du pays, capte des intentions de voyage, et les transforme en projets opérés par un réseau d'agences partenaires — Direction l'Algérie restant la seule interface visible du voyageur.

---

## 2. Porteur, pilotage, périmètres

| Acteur | Rôle |
|--------|------|
| **Houari Ayadi** | Porteur du projet. Auteur de la série documentaire YouTube qui constitue la matrice narrative et identitaire du projet. Référent lead opérationnel sur le back-office. |
| **INSEN Studio** | Pilotage stratégique, produit, design et développement. Mehdi en lead, Houari en associé. |
| **Direction l'Algérie** | Marque, projet et future entité opérationnelle. Cliente / projet d'INSEN Studio. |

Ne jamais confondre : on s'adresse à **Mehdi** comme interlocuteur INSEN ; **Houari** est son associé et le porteur fonctionnel de Direction l'Algérie.

---

## 3. Conviction fondatrice

L'Algérie dispose d'un potentiel culturel, historique, paysager et émotionnel immense, encore insuffisamment mis en scène dans des formats contemporains, lisibles et désirables à l'échelle digitale.

Direction l'Algérie répond à ce manque en construisant un écosystème cohérent fondé sur trois fonctions complémentaires :

1. **Produire et diffuser un récit immersif** sur l'Algérie.
2. **Structurer une exploration éditoriale et territoriale** du pays.
3. **Transformer l'intérêt suscité en demandes de voyage qualifiées**, puis en voyages opérés.

Le projet ne se positionne ni comme un site touristique standard, ni comme un média d'actualité, ni comme une agence classique. C'est une **infrastructure narrative et digitale** qui couvre toute la chaîne du contenu jusqu'à l'opération touristique.

---

## 4. Architecture du système — vue d'ensemble

Direction l'Algérie est composé de **deux moitiés principales** (façade publique + back-office), alimentées par **trois canaux d'entrée** dont un projet INSEN sœur dédié à la lead generation.

```
┌─────────────────────────────────────────────────────────────┐    ┌─────────────────────────────────────────────────────────────┐
│  FAÇADE PUBLIQUE — directionlalgerie.com                    │    │  PROJET SŒUR — authenticalgeria.com                         │
│  Squarespace + injections HTML/CSS/JS custom + YouTube      │    │  Next.js 16 · Claude API · Supabase · Mapbox · Posthog      │
│                                                              │    │                                                              │
│  Sections : Regarder · Explorer · Lire/Dossier · Voyager    │    │  Guide digital haut de gamme structuré pour citation IA.    │
│  Sortie principale : Voyage Planner multi-étapes            │    │  Module IA 5 étapes → brief voyageur généré par Claude API  │
└─────────────────────────────────────────────────────────────┘    └─────────────────────────────────────────────────────────────┘
                              │                                                      │
             POST /api/intake (web_form, idempotent)              POST /api/da/leads (webhook AA, à confirmer)
                              │                                                      │
                              │       ┌──────────────────────────────────┐          │
                              │       │  WhatsApp Business API (Meta)    │          │
                              │       │  Webhook signé, conversation IA  │          │
                              │       └──────────────────────────────────┘          │
                              │                       │                              │
                              ▼                       ▼                              ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │  BACK-OFFICE — app.directionlalgerie.com                     │
                    │  Travel Lead Desk · Next.js 16 + React 19 + Supabase        │
                    │                                                              │
                    │  Qualifie, score, route vers agences, arbitre, produit      │
                    │  le devis DA, suit le dossier                               │
                    │                                                              │
                    │  Règle absolue : le voyageur ne parle JAMAIS à l'agence     │
                    └─────────────────────────────────────────────────────────────┘
                                                      │
                                              Consultations
                                              internes DA
                                                      ▼
                                          Réseau d'agences partenaires
                                          (marque blanche, jamais en
                                          contact direct avec le voyageur)
```

**Lecture du schéma** :

- La **façade publique** attire, inspire et capte via son Voyage Planner.
- **Authentic Algeria**, projet INSEN distinct, génère des leads ultra-qualifiés via un module IA 5 étapes et les transmet à DA via webhook dédié. Son KPI unique est la qualité des leads envoyés à DA.
- **WhatsApp** est un canal conversationnel en cours de finalisation.
- Le **back-office** Travel Lead Desk consolide les trois entrées, qualifie, score, route vers les agences partenaires et produit le devis au nom de Direction l'Algérie.

Ces briques ne doivent jamais être pensées séparément. La façade et Authentic Algeria **génèrent et structurent la demande** ; le back-office **l'exploite, la suit et la transforme en revenu**.

---

## 5. Façade publique — directionlalgerie.com

### 5.1 Mission

Le site public est la porte d'entrée principale du projet. Il s'adresse au grand public, en particulier aux voyageurs potentiels, aux membres de la diaspora, aux curieux de culture, aux passionnés de patrimoine et aux personnes en recherche d'inspiration voyage.

Sa mission est quadruple :

1. **Attirer** du trafic via contenu, vidéo et référencement naturel.
2. **Immerger** l'utilisateur dans un récit fort.
3. **Aider à explorer** territoires, thèmes et imaginaires du pays.
4. **Faire émerger un projet de voyage** et capter cette intention.

### 5.2 Architecture éditoriale

| Section | Rôle | État avril 2026 |
|---------|------|------------------|
| **Regarder** | Pôle audiovisuel : vidéos, grands formats documentaires, ancrage de marque | Fonctionnelle |
| **Explorer** | Hubs territoriaux (villes, régions, grands thèmes) — entrée par territoire | Solide en inspiration ; à approfondir en informationnel |
| **Lire / Dossier** | Couche éditoriale textuelle — vocation média culturel structuré, pas blog | Existe ; taxonomie et articulation à renforcer |
| **Voyager** | Brique de conversion : circuits, inspirations, carte, FAQ, **Voyage Planner multi-étapes** | Le plus abouti — porte la promesse business |
| **À propos / Contact** | Pages institutionnelles, crédibilité, contacts partenariaux | En place |

### 5.3 Hubs territoriaux et thématiques déjà couverts

Alger · Oran · Béjaïa · Constantine · Tlemcen · Annaba · Sahara · Algérie antique.

Chaque hub propose une lecture éditoriale propre (capitale historique, identité andalouse, dimension paysagère, patrimoine architectural, etc.) et évite le ton du guide touristique standardisé.

### 5.4 Actifs déjà en ligne

- HERO immersifs cohérents avec le positionnement.
- Viewer vidéo avancé.
- Navigation custom de type mega menu.
- Hubs Explorer pour les principales villes et grands thèmes.
- Section Regarder fonctionnelle.
- Section Lire / Dossier déjà existante.
- Section Voyager aboutie avec planner multi-étapes.
- Pages institutionnelles À propos et Contact.

### 5.5 Manque stratégique principal — pages POI

Les **pages POI (points d'intérêt) ne sont pas encore développées**. Elles devaient constituer le cœur du dispositif SEO et de la profondeur éditoriale du projet.

Aujourd'hui, les fiches vidéo remplacent en partie ce rôle. Conséquences :

- Limitation de la captation organique sur les requêtes liées aux lieux précis.
- Maillage interne incomplet entre lieu, ville, thème et projection voyage.
- Sous-exploitation de la richesse documentaire existante.
- Écart entre la force visuelle du projet et sa profondeur textuelle indexable.

À terme, une page POI solide doit pouvoir : répondre à une intention de recherche claire, mettre en scène le lieu fidèlement à l'univers de marque, intégrer les contenus documentaires existants, et renvoyer vers ville / thème / circuits / Voyager.

### 5.6 Parcours cible utilisateur

L'expérience est pensée comme une progression. L'utilisateur n'est pas précipité vers un formulaire ; il est d'abord séduit, puis orienté, puis rassuré, puis invité à agir.

1. Entrée par une vidéo, un contenu éditorial, une recherche Google ou un partage social.
2. Découverte d'un territoire, d'un lieu ou d'un récit.
3. Renforcement du désir de voyage par l'exploration et la projection.
4. Passage vers la section Voyager.
5. Soumission d'une demande qualifiée via le Voyage Planner ou, à terme, via WhatsApp.

---

## 6. Back-office — Travel Lead Desk

### 6.1 Définition produit

Le Travel Lead Desk est un **outil interne premium de gestion de leads voyage**. Il permet à Direction l'Algérie de :

1. Capter des demandes de voyage (formulaire web, WhatsApp, manuel, email).
2. Comprendre et qualifier le besoin (avec assistance IA).
3. Affiner progressivement le projet.
4. Consulter une ou plusieurs agences partenaires en marque blanche.
5. Comparer les propositions agences (avec assistance IA).
6. Co-construire un voyage.
7. Produire un devis consolidé au nom de Direction l'Algérie.
8. Envoyer ce devis au voyageur.

### 6.2 Règle non-négociable

> **Le voyageur ne communique JAMAIS directement avec l'agence partenaire.**

Direction l'Algérie est l'unique interface, le filtre, le chef d'orchestre, le garant de l'expérience. Toute évolution fonctionnelle doit préserver — ou explicitement débattre — ce principe.

Conséquences concrètes :
- Toutes les données agence sont **internes** (notes, chiffrages bruts, négociations).
- Le devis envoyé au voyageur est **toujours reformulé et porté par Direction l'Algérie**.
- Le voyageur ne reçoit jamais le contact direct d'une agence dans aucun document.

### 6.3 Vision v2 — orchestration IA + WhatsApp + superviseur humain

La version cible (PRD v2, avril 2026) ajoute une couche IA opérée côté serveur OpenAI, avec **supervision humaine obligatoire avant toute étape critique**.

**Canaux d'entrée** :

| Canal | `intake_channel` | Notes |
|-------|------------------|-------|
| Formulaire web — Voyage Planner | `web_form` | `submission_id` (idempotent), `intake_payload`, `POST /api/intake` |
| WhatsApp | `whatsapp` | `whatsapp_phone_number` ; webhook crée le lead si inconnu |
| **Authentic Algeria** (projet sœur) | `web_form` (webhook externe) | `POST /api/da/leads` — endpoint, auth header et format JSON à figer avec Houari |
| Manuel | `manual` | Opérateur |
| Email | `email` | Réservé extension |

**Déclencheur conversation IA** : passage de `referent_id` de `null` à une valeur (assignation), pas la création du lead.

### 6.4 Flux opérationnel (5 étapes)

1. **Qualification** — IA converse avec le voyageur (WhatsApp). Stocke `conversation_transcript`, `ai_qualification_payload`, `ai_qualification_confidence`, `scoring_weights`. L'opérateur valide / modifie / rejette (`qualification_validation_status`).
2. **Shortlist agences** — IA score les agences à partir de `circuits_data`, `performance_history`, etc. → propositions dans `lead_circuit_proposals` avec `ai_match_score`, `ai_match_rationale`, `ai_recommended` (une seule agence recommandée à la fois).
3. **Envoi multi-agences** — l'opérateur valide et lance les consultations ; les réponses des agences atterrissent dans `agency_proposal_payload`.
4. **Comparaison** — IA score les propositions reçues (`ai_proposal_score`, `ai_recommended`) ; l'opérateur arbitre.
5. **Devis DA** — devis reformulé au nom de Direction l'Algérie ; envoi au voyageur (`quotes.sent_at`, `sent_via`, `pdf_storage_path`).

### 6.5 Rôles métier

| Rôle | Périmètre |
|------|-----------|
| **Référent lead** (Houari, Mehdi au lancement) | Pilote un dossier de la qualification au devis voyageur. Accès base agences, lancement consultations, comparaison, production devis DA. Tous les référents partagent les mêmes écrans et le même processus ; seule l'**assignation du dossier** les distingue (round-robin par défaut, réassignation manuelle possible et tracée). |
| **Admin** | Paramétrage, visibilité élargie, gestion utilisateurs, édition des poids du score, suppression hard des leads. |
| **Agence** (futur) | Hors scope initial. À trancher si un portail partenaire limité est ouvert plus tard. |

### 6.6 Cockpit lead v4 — interface fiche dossier

La fiche `/leads/[id]` offre une **visibilité constante** sur le score, l'état IA et un résumé dossier sans quitter l'étape active.

Composants :
- **Bande cockpit** : référence (`DA-YYYY-NNNN`), pastille score, pastille IA, bouton suspendre / reprendre.
- **Pipeline horizontal cliquable** : `new → qualification → agency_assignment → co_construction → quote → negotiation → won → lost`.
- **Workspace par étape** : panneaux contextuels selon l'étape active.
- **Encart Dossier** : résumé compact (voyageurs, budget, score, confiance IA, validation, référent).
- **Bottom nav + drawer Détails** : navigation rapide, CTA primaire (étape suivante).
- **Modale score paramétrable** : édition des poids réservée admin.

### 6.7 Pipeline et statuts

**Lead** : `new` → `qualification` → `agency_assignment` → `co_construction` → `quote` → `negotiation` → `won` / `lost`

**Devis** : `draft` → `in_progress` → `ready` → `sent` → `accepted` / `refused`

Les statuts distinguent la chaîne **devis agence** (interne) du **devis DA voyageur** (externe).

### 6.8 Score lead

Score 0–100 calculé à partir de pondérations stockées dans `leads.scoring_weights`. Pondérations par défaut :

| Critère | Poids défaut |
|---------|--------------|
| Budget | 25 |
| ADN (avancement pipeline) | 20 |
| Dates | 20 |
| Engagement | 15 |
| Conversation | 10 |
| Voyageurs | 10 |

Override possible via `lead_score_override` (admin).

---

## 7. Les canaux d'entrée du back-office

Le Travel Lead Desk consolide **trois canaux d'entrée principaux**, avec deux canaux secondaires (manuel, email).

### 7.1 Formulaire Squarespace → API intake

- **Source** : Voyage Planner sur le site public (Squarespace + JS custom).
- **Cible** : `POST /api/intake` côté Travel Lead Desk.
- **Format** : JSON, idempotent par `submission_id`.
- **Sécurité** : `ALLOWED_ORIGIN` (CORS), `INTAKE_SHARED_SECRET` optionnel, client Supabase **service_role** côté serveur uniquement.

### 7.2 WhatsApp (en cours de finalisation)

- **Webhook** : `POST /api/whatsapp/webhook` (vérification `X-Hub-Signature-256` via `WHATSAPP_APP_SECRET`).
- Création automatique d'un lead si numéro inconnu (`intake_channel = 'whatsapp'`).
- Conversation IA déclenchée à l'assignation d'un référent.

### 7.3 Authentic Algeria (projet INSEN sœur)

**Authentic Algeria** (authenticalgeria.com) est un projet INSEN distinct, conçu dès l'origine comme **générateur de leads ultra-qualifiés pour Direction l'Algérie**. Son KPI unique, explicitement formulé dans sa vision stratégique : *nombre et qualité des leads envoyés à Direction l'Algérie*.

**Positionnement AA** : guide touristique digital haut de gamme, structuré pour la citation IA (GEO), connecté à un module de conversion. Ni OTA, ni blog, ni agrégateur, ni office de tourisme.

**Flux d'un lead Authentic Algeria vers DA** :

1. Utilisateur complète le **module IA 5 étapes** sur authenticalgeria.com.
2. Brief voyageur généré par **Claude API** (itinéraire jour par jour, POI sélectionnés, estimations logistiques).
3. PDF envoyé au voyageur via **Resend**.
4. **Webhook `POST /api/da/leads`** côté Direction l'Algérie — endpoint, auth header et format JSON **à figer avec Houari**.
5. Queue + email fallback si échec webhook.
6. **Endpoint retour `/api/leads/status`** côté AA pour recevoir les mises à jour DA (statut, devis, signature — relances T+30, T+90).

**Anatomie d'un lead AA** (plus riche que les autres canaux) :

- Identité : nom, email, téléphone.
- Profil : durée souhaitée, intérêts, budget, dates, taille du groupe.
- Brief généré : itinéraire jour par jour, POI sélectionnés, estimations logistiques.
- Contexte navigation : page d'entrée, source trafic, score d'intention.

**Chantiers ouverts de coordination** (détaillés dans le Hub Notion Relation Houari) :

- Confirmer endpoint webhook côté DA (URL + auth header).
- Valider format JSON du payload lead.
- Définir SLA de traitement lead côté DA.
- Brancher le webhook retour status (T+30, T+90).
- Installer un point hebdo (15 min) sur la qualité des leads.

### 7.4 Email (réservé extension)

Canal prévu, non implémenté pour la qualification. Resend est utilisé pour les **emails transactionnels sortants** (workflow voyageur, confirmations, etc.).

---

## 8. Modèle économique

Direction l'Algérie n'opère pas directement les séjours. C'est une **plateforme intermédiaire et un générateur de demande**, sur un modèle marketplace / lead routing B2B2C.

Logique économique :

1. Le site public et les canaux éditoriaux attirent des voyageurs potentiels.
2. Ces voyageurs formulent une intention via le planner ou un canal conversationnel.
3. La demande est qualifiée, scorée et routée.
4. Une ou plusieurs agences partenaires prennent ensuite le relais opérationnel.
5. Direction l'Algérie monétise cette intermédiation via une **commission sur lead converti**.

Cohérence du modèle : le contenu n'existe pas pour lui-même — il alimente un système de captation et de transformation de la demande.

---

## 9. Stack technique consolidée

### 9.1 Façade publique

| Couche | Choix |
|--------|-------|
| Site public | Squarespace + injections HTML / CSS / JS custom |
| Vidéo | YouTube |
| Domaine | `directionlalgerie.com` (racine = site public) |

### 9.2 Back-office Travel Lead Desk

| Couche | Choix |
|--------|-------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Langage | TypeScript |
| Styles | Tailwind CSS v4 |
| Backend | Supabase (Postgres, Auth, RLS) |
| IA | OpenAI (modèle configurable via `OPENAI_MODEL`, défaut `gpt-4o`) |
| Canal voyageur cible | WhatsApp Business API (Meta) |
| Emails transactionnels | Resend |
| PDF (devis) | `@react-pdf/renderer` |
| Automations | n8n |
| Hébergement | Vercel |
| Sous-domaine | `app.directionlalgerie.com` |

### 9.3 Authentic Algeria (projet INSEN sœur)

Projet distinct du Travel Lead Desk mais **techniquement connecté** à DA. Référence Notion : `01 — Projets internes → Authentic Algeria`. Domaine : `authenticalgeria.com` (à venir).

| Couche | Choix |
|--------|-------|
| Framework | Next.js 16 |
| Langage | TypeScript |
| Styles | Tailwind CSS v4 |
| Backend | Supabase |
| Cartographie | Mapbox |
| Médias | Cloudinary |
| IA | Claude API (génération du brief voyageur) |
| Analytics | Posthog |
| Emails | Resend |
| Hébergement | Vercel |

Statut avril 2026 : Sprint 1/8 (Setup & Audit DataForSEO). 0/30 pages publiées, 0 leads transmis à DA. Périmètre v1 (J+56) : 3 wilayas (Alger, Tamanrasset, Constantine), 20 POI, 2 carnets, 5 infos pratiques, 2 pages synthèse GEO, module IA + pipe lead DA.

### 9.4 Workflow de développement (INSEN)

- Tout le travail local → review → `git commit` → `git push` → GitHub.
- Jamais de travail direct sur `main` ; branche dédiée (`feat/...`, `refonte/...`).
- Claude Code opère sur les fichiers VS Code locaux.
- Cursor en parallèle selon contexte.
- Migrations Supabase versionnées dans `supabase/migrations/`, appliquées via `npm run db:push`.

### 9.5 Variables d'environnement clés

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement), `OPENAI_API_KEY`, `OPENAI_MODEL`, `WHATSAPP_*`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_DA_CONTACT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_DA_NUMBER`, `ALLOWED_ORIGIN`, `INTAKE_SHARED_SECRET` (optionnel).

Détail complet : `.env.example` à la racine du dépôt.

---

## 10. État global du projet — avril 2026

### 10.1 Façade publique

| Brique | État |
|--------|------|
| HERO, mega menu, viewer vidéo | En ligne |
| Section Regarder | Fonctionnelle |
| Section Explorer (8 hubs) | Solide en inspiration, à approfondir |
| Section Lire / Dossier | Existante, taxonomie à renforcer |
| Section Voyager + Voyage Planner | Aboutie |
| Pages institutionnelles | En place |
| **Pages POI** | **Manquantes — gap stratégique majeur** |

### 10.2 Back-office

| Brique | État |
|--------|------|
| Auth Supabase + RLS de base | OK |
| Liste / Kanban leads | OK |
| Cockpit lead v4 (bande, pipeline, dossier, bottom nav) | Implémenté |
| Référence `DA-YYYY-NNNN` | Implémentée |
| Score lead paramétrable | Implémenté |
| Annuaire agences | OK |
| Workflow opérateur (qualification → consultations → arbitrage → devis) | Implémenté en v1, enrichi v2 |
| Server actions IA (qualification, shortlist, comparaison, autopilot) | Implémentées |
| Génération PDF devis | OK |
| API intake `/api/intake` | OK (avec idempotence + CORS + secret optionnel) |
| Webhook WhatsApp `/api/whatsapp/webhook` | Brique en place, à brancher fin-end |
| RLS production complète | Checklist à dérouler avant prod |
| Matrice droits / RLS détaillée (référent vs admin) | À formaliser dans une passe dédiée |

### 10.3 Canaux d'entrée et intégrations amont

- Voyage Planner Squarespace → `POST /api/intake` : **opérationnel**.
- WhatsApp → webhook : tuyaux posés, **à finaliser et tester de bout en bout**.
- Authentic Algeria → `POST /api/da/leads` : endpoint cible défini, **à confirmer et à implémenter** (endpoint, auth header, format JSON, webhook retour status).
- Pages POI → fiches lead enrichies par contexte éditorial : non implémenté (dépend de la création des POI).

### 10.4 Authentic Algeria (projet sœur)

| Brique | État |
|--------|------|
| Vision & stratégie AA figées | OK (Hub Notion Authentic Algeria) |
| Repo GitHub `authenticalgeria` | À créer (Sprint 1, Bloc 1) |
| Setup Next.js 16 + stack v1 | À faire |
| Module IA 5 étapes + brief Claude | À concevoir et produire |
| Contenu v1 (3 wilayas, 20 POI, 2 carnets, 5 infos pratiques, 2 pages synthèse GEO) | 0/30 pages publiées |
| Webhook AA → DA (`/api/da/leads`) | À brancher |
| Webhook retour DA → AA (`/api/leads/status`) | À brancher |
| Premier lead transmis à DA | 0 |

---

## 11. Priorités de développement

### 11.1 Façade publique (court terme)

1. **Formaliser la taxonomie** : villes, régions, thèmes, POI, circuits — règles claires de catégorisation et d'URL.
2. **Concevoir et produire la première vague de pages POI prioritaires** (cœur du dispositif SEO et de la profondeur éditoriale).
3. **Renforcer la structure éditoriale Lire / Dossier** (rubriques, formats, cadence).
4. **Connecter plus étroitement Explorer ↔ Lire ↔ Voyager** (maillage interne, CTA contextuels).

### 11.2 Back-office (court terme)

5. **Brancher pleinement le Voyage Planner à la couche CRM / Supabase** (validation E2E, gestion d'erreur, mapping des champs).
6. **Finaliser la conversation IA WhatsApp** : prompt qualification, garde-fous, supervisor-in-the-loop, modèle de message Meta.
7. **Formaliser la matrice droits / RLS** (référent vs admin, policies Supabase) avant mise en prod.
8. **Dérouler la checklist RLS production** (`docs/RLS_PROD_CHECKLIST.md`).

### 11.3 Coordination Authentic Algeria ↔ DA (court terme)

9. **Figer l'endpoint webhook** `POST /api/da/leads` côté DA (URL, auth header).
10. **Valider le format JSON** du payload lead transmis par AA.
11. **Définir le SLA de traitement** des leads AA côté DA.
12. **Brancher le webhook retour status** (`/api/leads/status` côté AA, mises à jour T+30, T+90).
13. **Installer le point hebdo (15 min)** sur la qualité des leads transmis.

### 11.4 Plateforme (moyen terme)

14. **Préparer l'ouverture progressive du portail partenaire** côté marketplace (UX agence, périmètre lecture / action, isolation des données).
15. **Modéliser la commission et la facturation** sur lead converti.
16. **Industrialiser les métriques** (sources, taux de conversion, charge opérateur, délai de devis).

---

## 12. Ambition à moyen terme

Devenir une **référence digitale sur l'Algérie**, en combinant trois qualités rarement réunies dans un même projet :

1. Une qualité de récit et de production visuelle forte.
2. Une profondeur éditoriale et territoriale exploitable.
3. Une capacité réelle à transformer l'intérêt en demande qualifiée puis en voyage opéré.

Autrement dit : ne pas se contenter d'être un média sur l'Algérie, mais devenir un **système d'information, de désir et d'orientation touristique** capable de faire le lien entre contenu, territoire et économie du voyage.

---

## 13. Glossaire

| Terme | Définition |
|-------|------------|
| **POI** | Point d'intérêt — lieu, monument, expérience ou repère patrimonial doté de sa propre page éditoriale. |
| **Hub territorial** | Page de section Explorer dédiée à une ville, région ou grand thème. |
| **Voyage Planner** | Formulaire multi-étapes côté site public qui structure la demande voyageur. |
| **Référent lead** | Personne Direction l'Algérie qui pilote un dossier de la qualification au devis voyageur. |
| **Consultation agence** | Sollicitation d'une agence partenaire sur un lead, données strictement internes. |
| **Devis agence** | Proposition d'une agence en réponse à une consultation. Données internes, jamais visibles voyageur. |
| **Devis DA** | Document reformulé / consolidé au nom de Direction l'Algérie, envoyé au voyageur. |
| **Cockpit lead** | Bande + pipeline horizontal + bottom nav + drawer sur la fiche lead. |
| **Référence lead** | Identifiant humain de format `DA-YYYY-NNNN`, unique par année. |
| **Supervisor-in-the-loop** | Pattern produit : l'IA propose, l'opérateur valide, modifie ou rejette avant toute action critique. |
| **Marque blanche** | Mode d'intermédiation où l'agence opérante reste invisible côté voyageur ; Direction l'Algérie porte la relation. |
| **Authentic Algeria (AA)** | Projet INSEN sœur (authenticalgeria.com). Guide touristique digital haut de gamme conçu comme générateur de leads ultra-qualifiés pour Direction l'Algérie. KPI unique : nombre et qualité des leads envoyés à DA. |
| **Module IA (AA)** | Parcours 5 étapes côté Authentic Algeria : recueil du besoin voyageur, génération d'un brief par Claude API (itinéraire, POI, logistique), envoi PDF et transmission à DA via webhook. |
| **GEO** | *Generative Engine Optimization* — optimisation des contenus pour la citation par les IA génératives (complément du SEO classique). Verticale prioritaire côté Authentic Algeria. |

---

## 14. Conventions et règles d'usage du document

- Ce document est **vivant** : à mettre à jour à chaque évolution structurante (nouveau canal, nouvelle brique, changement de stack).
- Toute incohérence entre ce document et un PRD plus récent → le PRD prime, et ce document doit être mis à jour dans la foulée.
- Les chiffres précis (commissions, tarifs, KPI) ne figurent **pas** ici tant qu'ils ne sont pas formalisés contractuellement.
- Aucune information sensible (clés, tokens, mots de passe, contenus de `.env.local`) ne doit jamais apparaître dans ce document.
- Référence canonique pour les contributeurs IA (Claude, Cursor, Claude Code) : ce document peut être chargé en contexte de session pour aligner toute production sur la vision projet.

---

## 15. Pointeurs vers la documentation détaillée

| Sujet | Document |
|-------|----------|
| Vision produit Travel Lead Desk v2 | `docs/PRD_TRAVEL_LEAD_DESK_V2.md` |
| Spec UX et règles métier détaillées | `docs/PRODUCT_SPEC.md` |
| Cockpit lead v4 (UI fiche) | `docs/PRD_COCKPIT_LEAD_V4.md` |
| Écarts plan / code | `docs/IMPLEMENTATION_PENDING_V2.md` |
| Checklist RLS production | `docs/RLS_PROD_CHECKLIST.md` |
| Déploiement Vercel + Supabase | `docs/DEPLOY_VERCEL.md` |
| Intake formulaire Squarespace | `docs/SQUARESPACE_FORM_INTAKE.md` |
| Bundle audit / brainstorming LLM | `docs/audit-claude-pro/README.md` (et fichier plat `docs/CLAUDE_AUDIT_CONTEXT.md`) |
| UI layout, tokens, panneaux | `docs/audit-claude-pro/UI_LAYOUT_AND_VISUAL.md` |
| Migrations Supabase | `supabase/migrations/*.sql` |
| Prompts IA serveur | `src/lib/ai/prompts/*.ts` |

---

*Direction l'Algérie — Document central — v2026.2 — Maintenu par INSEN Studio*