# Stack technique (snapshot)

Aligné sur [`package.json`](../../package.json) au moment du bundle (19 avril 2026).

## Runtime applicatif

| Couche | Technologie | Version (semver du manifest) |
|--------|---------------|-------------------------------|
| Framework | Next.js (App Router) | 16.2.4 |
| UI | React / React DOM | 19.2.4 |
| Langage | TypeScript | ^5 |
| Styles | Tailwind CSS | ^4 |
| Lint | ESLint + eslint-config-next | ^9 / 16.2.4 |

## Backend / données

| Service | Rôle |
|---------|------|
| Supabase | Postgres, Auth (email/password côté app), Row Level Security |
| `@supabase/supabase-js` | Client Supabase |
| `@supabase/ssr` | Intégration cookies / SSR avec Next.js |

## Bibliothèques notables

- `@dnd-kit/core`, `@dnd-kit/utilities` — drag & drop (ex. Kanban leads).
- `@react-pdf/renderer` — génération PDF (devis).
- `lucide-react` — icônes.

## Scripts npm utiles

- `npm run dev` — serveur de développement.
- `npm run build` — `next build --webpack`.
- `npm run start` — prod locale après build.
- `npm run lint` — ESLint.
- `npm run db:link` — `npx supabase@latest link`.
- `npm run db:push` — `npx supabase@latest db push` (migrations vers le projet lié).

## Hébergement & outils (cible)

- **Vercel** — hébergement Next.js (voir [docs/DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md)).
- **GitHub** — versioning.
- **Supabase CLI** — migrations dans [`supabase/migrations/`](../../supabase/migrations/).
