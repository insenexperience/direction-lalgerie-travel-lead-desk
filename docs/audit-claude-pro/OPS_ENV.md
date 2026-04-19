# Opérations et environnement

## Variables d’environnement

Définies pour l’app dans [`.env.example`](../../.env.example) :

| Variable | Usage |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé **anon** publique (safe côté navigateur avec RLS) |

**À ne jamais** commiter : `.env.local`, clé `service_role`, secrets tiers.

## Local

1. Copier `.env.example` → `.env.local`.
2. Renseigner les deux variables depuis Supabase → Settings → API.
3. `npm install` puis `npm run dev`.

## Déploiement (Vercel + Supabase)

Guide pas à pas : [docs/DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md).

Points clés pour l’audit :

- Même paire `NEXT_PUBLIC_*` en **Production** et **Preview** sur Vercel.
- **Supabase → Authentication → URL configuration** : Site URL + Redirect URLs (`localhost`, `*.vercel.app`, domaine final) — sans quoi login / redirections cassent après déploiement.
- Migrations : `npm run db:push` ou exécution ordonnée des fichiers dans `supabase/migrations/`.

## Base de données

- Config CLI : [`supabase/config.toml`](../../supabase/config.toml).
- Après déploiement RLS « admin vs référent », au moins un compte **admin** doit être promu manuellement (voir commentaire dans la migration `20260423140000`).
