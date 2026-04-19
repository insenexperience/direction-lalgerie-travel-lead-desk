# Paquet d’audit — Claude Pro

**Dernière mise à jour du bundle : 19 avril 2026** (snapshot du dépôt à cette date).

Ce dossier regroupe une **documentation courte et structurée** pour faire auditer ou brainstormer l’application **Direction l’Algérie — Travel Lead Desk** avec Claude Pro (ou tout autre LLM), **sans coller de secrets** dans le chat.

## Avertissements

- **Ne jamais** coller le contenu de `.env.local`, de clés Supabase `service_role`, ni d’URL/credentials de prod dans une conversation.
- Les **fichiers sources** et **migrations SQL** restent la source de vérité ; ce bundle résume et pointe vers eux.

## Ordre de lecture recommandé

1. [STACK.md](./STACK.md) — versions et dépendances.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — auth, App Router, flux données.
3. [DATA_SUPABASE.md](./DATA_SUPABASE.md) — modèle Postgres / migrations.
4. [PRODUCT_RULES_SUMMARY.md](./PRODUCT_RULES_SUMMARY.md) — règles métier (résumé).
5. [ROUTES_AND_FEATURES.md](./ROUTES_AND_FEATURES.md) — écrans, API, server actions.
6. [OPS_ENV.md](./OPS_ENV.md) — env, déploiement.
7. [PROMPTS_CLAUDE_PRO.md](./PROMPTS_CLAUDE_PRO.md) — modèles de prompts réutilisables.

## Comment l’utiliser dans Claude Pro

- **Option A** : ouvrir ce dépôt dans l’IDE et attacher le dossier `docs/audit-claude-pro/` (ou le repo entier) si ton outil le permet, puis poser des questions ciblées.
- **Option B** : copier-coller les fichiers `.md` de ce dossier **dans l’ordre ci-dessus** (sans `.env`).
- Pour aller plus loin : demander à l’auditeur de lire en parallèle [docs/PRODUCT_SPEC.md](../PRODUCT_SPEC.md) (spec produit complète) et les fichiers cités dans chaque section.

## Maintenance

Après un changement majeur (nouvelle migration, nouvelle route, bump de framework), mettre à jour les fichiers concernés et la date en tête de ce `README.md`.
