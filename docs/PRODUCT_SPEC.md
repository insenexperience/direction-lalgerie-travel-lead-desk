# Direction l’Algérie — Travel Lead Desk

## Product & Build Specification (Cursor Ready)

**Mise à jour v2 (avril 2026)** : la vision cible (orchestration IA, WhatsApp, schéma données, critères de succès) est décrite dans **[PRD_TRAVEL_LEAD_DESK_V2.md](./PRD_TRAVEL_LEAD_DESK_V2.md)**. Ce document reste la spec détaillée UX / règles métier et glossaire ; en cas de divergence, le PRD v2 prime pour la roadmap produit.

---

# 1. Vision produit

Cette application est un **outil interne premium de gestion de leads voyage**.

Elle permet à Direction l’Algérie de :

* capter des demandes de voyage
* comprendre et qualifier le besoin
* affiner progressivement le projet
* consulter des agences partenaires en marque blanche
* co-construire un voyage
* produire un devis consolidé
* envoyer ce devis au voyageur

---

# 2. Principe fondamental (NON NÉGOCIABLE)

Le voyageur ne communique **JAMAIS** directement avec l’agence.

Direction l’Algérie est :

* l’unique interface
* le filtre
* le chef d’orchestre
* le garant de l’expérience

Toute l’application doit être pensée autour de cette règle.

---

# 3. Rôle de Cursor dans le projet

Ce projet est développé avec **Cursor comme copilote principal**.

Cela implique :

* code généré avec assistance IA
* besoin de spécifications **claires, structurées, sans ambiguïté**
* développement **itératif par petites tâches**
* validation humaine à chaque étape

---

# 4. Philosophie de développement

## 4.1 Approche

* construire petit → tester → améliorer
* éviter le code complexe inutile
* privilégier la lisibilité
* toujours comprendre ce que fait le code généré

## 4.2 Règles pour Cursor

Toujours :

* écrire du TypeScript propre
* découper en composants simples
* éviter les gros fichiers
* commenter le code important
* expliquer les choix

---

# 5. Stack technique

## Frontend

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* shadcn/ui (optionnel)

## Backend

* Supabase

  * Postgres
  * Auth
  * RLS

Schéma SQL versionné : `supabase/migrations/` (appliquer sur le projet Supabase : SQL Editor ou CLI `supabase db push`).  
Variables d’environnement : voir `.env.example` → copie locale `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Dev

* Cursor
* GitHub
* Vercel

---

# 6. Architecture cible

```txt
/app
  /(auth)
    /login
  /(dashboard)
    /dashboard
    /leads
    /leads/[id]
    /quotes
    /agencies
    /users
    /settings
  /api

/components
/lib
  /supabase
  /services
/types
/docs
```

---

# 7. Modules produit

## 7.1 Auth

* login
* gestion session
* rôles applicatifs (voir ci-dessous)

### Rôles (vue métier)

* **Référent lead** (nom produit recommandé ; synonyme acceptable : *opérateur lead desk*) : personne Direction l’Algérie qui pilote un dossier de la qualification jusqu’au devis voyageur. Accès base agences, lancement de consultations, comparaison des réponses, production du devis DA.
* **Admin** (ou rôle équivalent) : paramétrage, visibilité élargie, gestion utilisateurs — périmètre exact à cadrer avec les besoins internes.
* **Agence** (si un jour accès outil limité côté partenaire) : hors scope initial si tout reste interne ; à trancher plus tard.

Les **deux référents lead** opérationnels au lancement (ex. Houari, Mehdi) partagent **le même processus métier** et les **mêmes écrans** ; seule l’**assignation du dossier** les distingue (voir §7.14).

### Autorisations (à détailler en itération ultérieure)

Le produit prévoit **deux niveaux d’autorisation distincts** (matrice droits / périmètres : lecture seule vs action, vue « mes leads » vs « tous les leads », administration, etc.). **Le détail exact (noms des rôles techniques, RLS, policies) sera formalisé dans une passe dédiée** ; cette spec en pose déjà les fondations métier (référent vs reste).

---

## 7.2 Dashboard

* vue globale
* KPI
* tâches
* activité

---

## 7.3 Leads

* liste des leads
* recherche / filtres
* création lead

### 7.3.1 Parcours opérateur (doc vivante)

* **Document canonique des flux** (diagrammes, couches d’état, conflits connus, changelog) : [`USER_JOURNEYS.md`](./USER_JOURNEYS.md). Il doit **évoluer avec le code** : toute évolution des règles pipeline, qualification, workflow voyageur, référent, intake ou RLS sur les leads y est reflétée (voir [`CONTRIBUTING.md`](../CONTRIBUTING.md)).
* **Modèle mental** : le statut pipeline (`leads.status`) n’est pas la seule dimension — session workflow, `manual_takeover`, validation qualification et agence retenue peuvent interagir ; le détail est dans `USER_JOURNEYS.md`.

---

## 7.4 Lead Detail

* vue complète d’un lead
* qualification
* assignation **référent lead** (tour à tour ou manuelle) et suivi des **consultations agences**
* timeline
* **Hiérarchie écran (avril 2026)** : la carte **étape active** (tâche courante) est affichée **en premier** dans le contenu scrollable ; la section **Contexte** regroupe workflow lancé + bloc conversation / IA ; l’encart Dossier (cockpit) expose le CTA **« Modifier la fiche »** vers l’ancre `#lead-fiche-edit`.

---

## 7.5 Qualification

* budget
* voyageurs
* dates
* style
* score
* résumé DA

### 7.5.1 Gate « brief exploitable » avant assignation agence partenaire

* **Objectif** : ne passer à l’étape **Assignation** (`agency_assignment`) qu’avec une fiche suffisamment complète et une qualification cohérente (parcours IA ou manuel).
* **Implémentation** : pas de nouvelle valeur dans l’enum Postgres `lead_status` ; contrôle dans [`src/app/(dashboard)/leads/actions.ts`](../src/app/(dashboard)/leads/actions.ts) (`assertBriefExploitableBeforeAgencyAssignment`) pour les transitions `qualification` → `agency_assignment` (y compris via `moveLeadPipelineStep` / pipeline cockpit).
* **Règles** (détail dans [`src/lib/lead-brief-gate.ts`](../src/lib/lead-brief-gate.ts)) :
  * champs minimum renseignés sur le lead : nom voyageur, e-mail, téléphone **ou** numéro WhatsApp DA, dates / période, groupe, budget, résumé du voyage, style ;
  * statut `rejected` → passage bloqué ;
  * qualification **validée ou ajustée** (`validated` / `overridden`) **ou** parcours **`workflow_mode = manual`** avec statut autre que `rejected` (champs complets = parité manuel sans blocage « pending » infini).
* **UI** : checklist sur la fiche lead lorsque `status = qualification` ; message d’action si le passage est encore bloqué ; bloc **Contexte** — boutons **Valider / Ajuster / Rejeter** dès que la validation est `pending`, même sans `ai_qualification_payload` (brief manuel ou IA sans synthèse structurée).

### 7.5.2 Session workflow voyageur (IA / manuel)

* Chaque lancement crée une **référence** `workflow_run_ref` (ex. `WF-…`) sur `public.leads`.
* Lancement possible depuis **Nouveau** ou **Qualification** tant qu’aucune session n’est active (`workflow_launched_at` + `workflow_mode`).
* **Suppression de session** (`resetWorkflowVoyageurSession` dans [`workflow-actions.ts`](../src/app/(dashboard)/leads/workflow-actions.ts)) : le référent remet à zéro mode / dates / référence, transcript, brouillon IA et validation qualification ; le statut pipeline ne change pas.
* **Reprise manuelle** : `manual_takeover` (bandeau cockpit) ; la page `/leads/[id]/workflow` n’est accessible que si l’IA est suspendue ou qu’aucune session n’est active (pas de session **manuelle** déjà enregistrée).
* **Cohérence pipeline (P0)** : à la sortie du statut `qualification` vers une autre étape, les champs de **session workflow** (`workflow_launched_at`, `workflow_mode`, `workflow_run_ref`, `workflow_launched_by`, `manual_takeover`) sont effacés côté serveur pour éviter une session « fantôme » ; idem lors d’un **changement de référent** (`assignLeadReferent`). Les non-admins ne peuvent pas sauter plusieurs étapes via `updateLeadStatus` (voir [`USER_JOURNEYS.md`](./USER_JOURNEYS.md)).

---

## 7.6 Evolution du besoin

* versions du besoin
* historique
* modifications

---

## 7.7 Agencies

* base partenaires
* spécialités
* zones

---

## 7.8 Agency Consultations

* sollicitation d’**une ou plusieurs** agences sur un même lead (mise en concurrence interne)
* suivi par agence : envoyé, relance, refus, proposition reçue
* notes internes (jamais visibles voyageur)
* le référent choisit la **meilleure offre** au regard du besoin (prix, couverture, délais, conditions) — vocabulaire métier : sélection de l’**agence retenue** (à ne pas confondre avec le « référent » côté DA)

---

## 7.9 Quotes

* **devis agence** : propositions issues des consultations (données **internes** DA)
* **devis Direction l’Algérie** : document **reformulé / consolidé** pour le voyageur, après arbitrage sur les offres agences
* versions, statuts (brouillon → prêt → envoyé, etc.)
* **version voyageur** : seule couche exposée au client final

⚠️ IMPORTANT :

* agency_notes / chiffrage brut agence = interne
* traveler_version = visible client ; toujours portée par la DA

---

## 7.10 Timeline

* historique complet
* actions
* événements

---

## 7.11 Tasks

* tâches liées aux leads
* relances
* priorités

---

## 7.12 Users

* gestion utilisateurs
* rôles

---

## 7.13 Settings

* statuts
* sources

---

## 7.14 Référents lead et répartition des dossiers

* Un lead a **un référent lead assigné** à un instant T (responsable du traitement côté DA).
* **Répartition tour à tour** entre les référents opérationnels (ex. Houari, Mehdi) : à l’entrée du lead dans le flux concerné (ex. création ou règle métier définie), assignation selon une logique **round-robin** pour équilibrer la charge.
* Les **exceptions** (réassignation manuelle, absence, escalade) sont possibles ; elles doivent rester **traçables** (timeline / activités).
* Chaque référent **s’appuie sur la base agences** pour cibler les partenaires et lancer les consultations ; pas de parcours différent entre référents, seulement des **droits d’accès** homogènes pour ce rôle (hors matrice admin détaillée plus tard).

---

# 8. Modèle de données (résumé)

Tables principales :

* leads (champs typiques : **référent assigné**, statut pipeline, liens vers consultations / devis)
* lead_snapshots
* agencies
* users (profil + **rôle** ; lien auth Supabase)
* quotes (discriminer si besoin : **origine agence** vs **devis DA voyageur** — modèle exact en schéma SQL lors de l’implémentation)
* activities
* tasks
* consultations (une ligne par couple lead × agence sollicitée, avec statut de suivi)

Données de configuration possibles pour le round-robin : compteur global ou file d’assignation — **à figer au moment du schéma Supabase**.

---

# 9. Workflow métier

## Lead (vue référent + agences)

* **Entrée du lead** → assignation **référent** (tour à tour entre les opérateurs concernés)
* Nouveau
* Qualification
* Affinage
* **Consultations** : sollicitation d’**une ou plusieurs** agences depuis la base partenaires
* Réception des propositions / devis agence (interne)
* **Arbitrage** : choix de la **meilleure offre** (agence retenue)
* **Devis Direction l’Algérie** pour le voyageur (reformulation / packaging DA)
* Co-construction (le cas échéant)
* Négociation
* Gagné / Perdu

## Devis

* Brouillon
* En cours
* Prêt
* Envoyé
* Accepté / Refusé

*(Les statuts peuvent distinguer une chaîne « devis agence » interne et un « devis DA voyageur » si le produit le exige.)*

---

# 10. Règles métier critiques

* pas de contact direct voyageur ↔ agence
* toutes les données agence sont internes
* DA reformule toujours avant envoi
* le besoin évolue dans le temps
* tout doit être traçable
* **référents lead** : même processus pour tous les opérateurs du rôle ; charge équilibrée par **round-robin** sauf réassignation explicite
* **deux niveaux d’autorisation** à détailler ultérieurement (voir §7.1) — implémentation Auth / RLS en conséquence

---

# 11. Stratégie de développement avec Cursor

## Étape 1

* setup projet
* auth (y compris socle des **deux niveaux d’autorisation** — détail des policies en itération dédiée)
* layout

## Étape 2

* leads (table + UI) + **assignation référent** (round-robin) dès que l’auth utilisateur est disponible

## Étape 3

* lead detail

## Étape 4

* qualification

## Étape 5

* agencies

## Étape 6

* consultations

## Étape 7

* quotes

---

# 12. Règles pour travailler avec Cursor

Quand tu demandes du code :

* toujours préciser le contexte
* donner le fichier cible
* demander du code simple
* demander une explication

Exemple :

“Create a simple Next.js page to list leads from Supabase with basic UI”

---

# 13. Objectif final

Construire un outil :

* robuste
* lisible
* premium
* scalable
* fidèle à Direction l’Algérie

---

# 14. Positionnement produit

Ce n’est pas :

* un CRM classique
* une marketplace

C’est :

👉 un **outil de pilotage de fabrication de voyages sur mesure**
👉 avec **co-construction en marque blanche**
👉 orchestré par Direction l’Algérie
