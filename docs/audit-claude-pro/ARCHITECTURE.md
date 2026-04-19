# Architecture applicative

## Vue d’ensemble

Application **Next.js App Router** avec pages serveur, **authentification Supabase** (session via cookies), données **Postgres** exposées au client via le client Supabase **anon** (sécurité portée par **RLS**).

## Flux requête / session

1. **Middleware** ([`middleware.ts`](../../middleware.ts)) intercepte les chemins (hors assets statiques) et appelle `updateSession`.
2. **`updateSession`** ([`src/lib/supabase/middleware.ts`](../../src/lib/supabase/middleware.ts)) crée un client Supabase SSR, lit `getUser()`, et réécrit les cookies de session sur la réponse.
3. **Racine** ([`src/app/page.tsx`](../../src/app/page.tsx)) : si utilisateur connecté → redirection vers `/dashboard`, sinon → `/login`.
4. **Layout dashboard** ([`src/app/(dashboard)/layout.tsx`](../../src/app/(dashboard)/layout.tsx)) : `createClient()` côté serveur, `getUser()` ; si pas d’utilisateur → `redirect("/login")`. Le segment est marqué `dynamic = "force-dynamic"` et `revalidate = 0` pour refléter la session à chaque requête.

```mermaid
flowchart LR
  subgraph edge [Edge_middleware]
    MW[middleware.ts]
    US[updateSession_supabase]
  end
  subgraph server [Server_RSC]
    Root[src/app/page.tsx]
    DashLayout["(dashboard)/layout.tsx"]
    Pages[Pages_et_Server_Actions]
  end
  MW --> US
  US --> Root
  US --> DashLayout
  DashLayout --> Pages
```

## Clients Supabase

- **Serveur** : [`src/lib/supabase/server.ts`](../../src/lib/supabase/server.ts) — utilisé dans les layouts/pages server et les server actions.
- **Client navigateur** : [`src/lib/supabase/client.ts`](../../src/lib/supabase/client.ts) — composants client interactifs.
- **Middleware** : construction inline dans [`src/lib/supabase/middleware.ts`](../../src/lib/supabase/middleware.ts).

Si `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` manquent, le middleware retourne une réponse sans erreur explicite (session non rafraîchie).

## Structure `src/`

| Zone | Rôle indicatif |
|------|----------------|
| [`src/app/`](../../src/app/) | Routes App Router, layouts, server actions par domaine. |
| [`src/components/`](../../src/components/) | UI réutilisable (sidebar, formulaires lead, modales, etc.). |
| [`src/context/`](../../src/context/) | React context (ex. démo / état UI agences). |
| [`src/lib/`](../../src/lib/) | Mappers Supabase, PDF, filtres file leads, champs CRM, utilitaires. |

## Points d’attention pour un audit

- **Auth** : contrôle d’accès UI surtout via layout dashboard ; la **sécurité réelle** repose sur **RLS** Supabase (voir [DATA_SUPABASE.md](./DATA_SUPABASE.md)).
- **PDF** : route API dédiée (voir [ROUTES_AND_FEATURES.md](./ROUTES_AND_FEATURES.md)) — vérifier autorisations et fuite de données côté PDF.
- **Contexte démo** : [`src/context/agencies-demo-context.tsx`](../../src/context/agencies-demo-context.tsx) enveloppe le dashboard — comprendre s’il reste du chemin « mock » vs données Supabase selon les écrans.
