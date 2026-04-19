# Paquet d’audit — Claude Pro

**Dernière mise à jour du bundle : 20 avril 2026** (aligné sur le dépôt courant : migrations, `package.json`, routes).

Ce dossier regroupe une **documentation structurée** (vue d’ensemble + pointeurs vers le code) pour faire auditer ou brainstormer l’application **Direction l’Algérie — Travel Lead Desk** avec Claude Pro (ou tout autre LLM), **sans coller de secrets** dans le chat.

**Connecteur Git « liste plate » (sans sous-dossiers)** : le même contenu est aussi dans un **seul fichier** à la racine de `docs/` → [`docs/CLAUDE_AUDIT_CONTEXT.md`](../CLAUDE_AUDIT_CONTEXT.md). Coche ce fichier dans Claude à la place de ce dossier. Quand tu modifies le bundle, mets à jour **ce README + les fichiers ici + `CLAUDE_AUDIT_CONTEXT.md`** pour rester cohérent.

## Avertissements

- **Ne jamais** coller le contenu de `.env.local`, de clés Supabase `service_role`, ni d’URL/credentials de prod dans une conversation.
- Les **fichiers sources** et **migrations SQL** restent la source de vérité ; ce bundle résume et pointe vers eux.

## Index rapide (hors bundle)

| Document | Usage pour un LLM |
|----------|-------------------|
| [CLAUDE_AUDIT_CONTEXT.md](../CLAUDE_AUDIT_CONTEXT.md) | **Fichier unique** (même info que ce dossier) si l’outil Git ne descend pas dans les sous-dossiers. |
| [PRD_TRAVEL_LEAD_DESK_V2.md](../PRD_TRAVEL_LEAD_DESK_V2.md) | Vision v2 : IA, WhatsApp, supervisor-in-the-loop. |
| [PRODUCT_SPEC.md](../PRODUCT_SPEC.md) | Spec UX / règles détaillées. |
| [IMPLEMENTATION_PENDING_V2.md](../IMPLEMENTATION_PENDING_V2.md) | Écarts planifiés code ↔ schéma (à lire avant d’auditer « l’état réel »). |
| [RLS_PROD_CHECKLIST.md](../RLS_PROD_CHECKLIST.md) | Contrôles RLS avant prod. |
| [DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md) | Vercel + Supabase Auth URLs + `db:push`. |
| [SQUARESPACE_FORM_INTAKE.md](../SQUARESPACE_FORM_INTAKE.md) | Intake web public → `POST /api/intake`. |
| [UI_LAYOUT_AND_VISUAL.md](./UI_LAYOUT_AND_VISUAL.md) | **Layout, design tokens, panneaux, mobile** — image mentale de l’app. |
| [PRD_COCKPIT_LEAD_V4.md](../PRD_COCKPIT_LEAD_V4.md) | Cockpit fiche lead (UI v4) + addendum décisions. |

## Ordre de lecture recommandé

0. [PRD_TRAVEL_LEAD_DESK_V2.md](../PRD_TRAVEL_LEAD_DESK_V2.md) — vision produit v2 (IA, WhatsApp, supervisor-in-the-loop).
1. [STACK.md](./STACK.md) — versions et dépendances.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — auth, App Router, flux données, IA côté serveur.
3. [UI_LAYOUT_AND_VISUAL.md](./UI_LAYOUT_AND_VISUAL.md) — coque dashboard, couleurs, typo, patterns de panneaux, fichiers UI clés.
4. [DATA_SUPABASE.md](./DATA_SUPABASE.md) — modèle Postgres / migrations (ordre complet).
5. [PRODUCT_RULES_SUMMARY.md](./PRODUCT_RULES_SUMMARY.md) — règles métier (résumé).
6. [ROUTES_AND_FEATURES.md](./ROUTES_AND_FEATURES.md) — écrans, API, server actions.
7. [OPS_ENV.md](./OPS_ENV.md) — env, déploiement.
8. [PROMPTS_CLAUDE_PRO.md](./PROMPTS_CLAUDE_PRO.md) — modèles de prompts réutilisables.

## Comment l’utiliser dans Claude Pro

- **Option A** : ouvrir ce dépôt dans l’IDE et attacher le dossier `docs/audit-claude-pro/` (ou le repo entier) si ton outil le permet, puis poser des questions ciblées.
- **Option B** : copier-coller les fichiers `.md` de ce dossier **dans l’ordre ci-dessus** (sans `.env`).
- Pour aller plus loin : [docs/PRODUCT_SPEC.md](../PRODUCT_SPEC.md) (détail UX / règles) + PRD v2 ci-dessus ; [`IMPLEMENTATION_PENDING_V2.md`](../IMPLEMENTATION_PENDING_V2.md) si le code n’a pas encore rattrapé le schéma v2.

## Maintenance

Après un changement majeur (nouvelle migration, nouvelle route, bump de framework), mettre à jour les fichiers concernés et la date en tête de ce `README.md`.
