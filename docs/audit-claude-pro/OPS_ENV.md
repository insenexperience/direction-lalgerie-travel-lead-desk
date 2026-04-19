# Opérations et environnement

## Variables d’environnement

Définies pour l’app dans [`.env.example`](../../.env.example) (liste exhaustive — ne pas committer les valeurs réelles) :

| Variable | Usage |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé **anon** publique (safe côté navigateur avec RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement : webhooks, `/api/intake`, opérations bypass RLS si utilisées dans le code |
| `ALLOWED_ORIGIN` | Origine(s) CORS pour `POST /api/intake` en prod ; **plusieurs** origines = liste séparée par **virgules** |
| `INTAKE_SHARED_SECRET` | Optionnel : authentifie `POST /api/intake` (`Authorization: Bearer` ou `X-Intake-Secret`) |
| `OPENAI_API_KEY` | Clé OpenAI **serveur uniquement** (jamais `NEXT_PUBLIC_`) |
| `OPENAI_MODEL` | Optionnel (ex. défaut `gpt-4o` côté code si vide) |
| `RESEND_API_KEY` | Emails transactionnels ; si absent, le desk peut enregistrer l’action sans envoi réel |
| `RESEND_FROM_EMAIL` | Expéditeur From pour Resend |
| `NEXT_PUBLIC_DA_CONTACT_EMAIL` | Email affiché (ex. mailto workflow) |
| `NEXT_PUBLIC_WHATSAPP_DA_NUMBER` | Numéro wa.me (chiffres + indicatif) |
| `WHATSAPP_PHONE_NUMBER_ID` | Cloud API |
| `WHATSAPP_API_TOKEN` ou `WHATSAPP_ACCESS_TOKEN` | Jeton Graph (le code peut accepter l’un ou l’autre) |
| `WHATSAPP_VERIFY_TOKEN` | Challenge webhook GET |
| `WHATSAPP_APP_SECRET` | Optionnel : vérif `X-Hub-Signature-256` sur POST |
| `WHATSAPP_QUALIFICATION_TEMPLATE` | Optionnel : nom template Meta 1er message |

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
