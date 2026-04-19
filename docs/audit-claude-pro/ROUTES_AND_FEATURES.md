# Routes, navigation et mutations

## Navigation principale (sidebar)

Définie dans [`src/lib/nav-config.tsx`](../../src/lib/nav-config.tsx) :

| Chemin | Libellé produit |
|--------|------------------|
| `/dashboard` | Tableau de bord |
| `/metrics` | Métriques & data |
| `/leads` | Leads |
| `/agencies` | Agences |
| `/quotes` | Devis |
| `/users` | Équipe |
| `/settings` | Réglages *(retiré de la sidebar ; route encore présente)* |

## Pages App Router (fichiers `page.tsx`)

| Route | Fichier |
|-------|---------|
| `/` | [`src/app/page.tsx`](../../src/app/page.tsx) |
| `/login` | [`src/app/login/page.tsx`](../../src/app/login/page.tsx) |
| `/dashboard` | [`src/app/(dashboard)/dashboard/page.tsx`](../../src/app/(dashboard)/dashboard/page.tsx) |
| `/metrics` | [`src/app/(dashboard)/metrics/page.tsx`](../../src/app/(dashboard)/metrics/page.tsx) |
| `/leads` | [`src/app/(dashboard)/leads/page.tsx`](../../src/app/(dashboard)/leads/page.tsx) |
| `/leads/[id]` | [`src/app/(dashboard)/leads/[id]/page.tsx`](../../src/app/(dashboard)/leads/[id]/page.tsx) |
| `/agencies` | [`src/app/(dashboard)/agencies/page.tsx`](../../src/app/(dashboard)/agencies/page.tsx) |
| `/quotes` | [`src/app/(dashboard)/quotes/page.tsx`](../../src/app/(dashboard)/quotes/page.tsx) |
| `/users` | [`src/app/(dashboard)/users/page.tsx`](../../src/app/(dashboard)/users/page.tsx) |
| `/settings` | [`src/app/(dashboard)/settings/page.tsx`](../../src/app/(dashboard)/settings/page.tsx) |

Le segment `(dashboard)` partage [`layout.tsx`](../../src/app/(dashboard)/layout.tsx) (auth + shell UI).

## API Routes (`route.tsx`)

| Endpoint | Fichier |
|----------|---------|
| `POST` / `OPTIONS` (intake formulaire site, CORS) | [`src/app/api/intake/route.ts`](../../src/app/api/intake/route.ts) |
| `GET` (challenge) / `POST` (webhook) WhatsApp | [`src/app/api/whatsapp/webhook/route.ts`](../../src/app/api/whatsapp/webhook/route.ts) |
| `GET` (PDF devis) | [`src/app/api/leads/[leadId]/quotes/[quoteId]/pdf/route.tsx`](../../src/app/api/leads/[leadId]/quotes/[quoteId]/pdf/route.tsx) |

## Server Actions (`"use server"`)

| Fichier | Domaine |
|---------|---------|
| [`src/app/(dashboard)/leads/actions.ts`](../../src/app/(dashboard)/leads/actions.ts) | Leads (CRUD / statut / assignation, etc.) |
| [`src/app/(dashboard)/leads/quote-actions.ts`](../../src/app/(dashboard)/leads/quote-actions.ts) | Devis liés aux leads |
| [`src/app/(dashboard)/leads/co-construction-actions.ts`](../../src/app/(dashboard)/leads/co-construction-actions.ts) | Co-construction |
| [`src/app/(dashboard)/agencies/actions.ts`](../../src/app/(dashboard)/agencies/actions.ts) | Agences partenaires |

Pour le détail des opérations (tables touchées, validations), lire le corps de chaque fichier.

## Fonctionnalités à cartographier lors d’un audit

- **Pipeline lead** : Kanban, détail lead, qualification CRM, consultations agences, devis, PDF.
- **Métriques** : agrégations côté client ou serveur (à vérifier dans les composants `*-page-inner.tsx` / libs associées).
