# Direction l’Algérie — Travel Lead Desk

Application interne Next.js + Supabase (auth, RLS, leads, agences, devis). Spécification produit : `docs/PRODUCT_SPEC.md`.

## Déploiement (GitHub + Vercel)

Procédure détaillée : **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** (dépôt GitHub, variables Vercel, redirections Supabase, domaine).

Variables d’environnement : copier `.env.example` vers `.env.local` en local ; sur Vercel, définir les mêmes clés `NEXT_PUBLIC_*` (voir fichier d’exemple).

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Voir **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)**. Documentation générique Next.js : [Deploying](https://nextjs.org/docs/app/building-your-application/deploying).
