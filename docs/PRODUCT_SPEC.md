# Direction l’Algérie — Travel Lead Desk

## Product & Build Specification (Cursor Ready)

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
* rôles (admin, operator, agency)

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

---

## 7.4 Lead Detail

* vue complète d’un lead
* qualification
* assignation
* timeline

---

## 7.5 Qualification

* budget
* voyageurs
* dates
* style
* score
* résumé DA

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

* sollicitation agence
* suivi réponse
* notes internes

---

## 7.9 Quotes

* devis
* versions
* statut
* version voyageur

⚠️ IMPORTANT :

* agency_notes = interne
* traveler_version = visible client

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

# 8. Modèle de données (résumé)

Tables principales :

* leads
* lead_snapshots
* agencies
* users
* quotes
* activities
* tasks
* consultations

---

# 9. Workflow métier

## Lead

* Nouveau
* Qualification
* Affinage
* Assignation agence
* Co-construction
* Devis
* Négociation
* Gagné / Perdu

## Devis

* Brouillon
* En cours
* Prêt
* Envoyé
* Accepté / Refusé

---

# 10. Règles métier critiques

* pas de contact direct voyageur ↔ agence
* toutes les données agence sont internes
* DA reformule toujours avant envoi
* le besoin évolue dans le temps
* tout doit être traçable

---

# 11. Stratégie de développement avec Cursor

## Étape 1

* setup projet
* auth
* layout

## Étape 2

* leads (table + UI)

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
