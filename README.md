# Direction l’Algérie — Travel Lead Desk

Application interne Next.js + Supabase (auth, RLS, leads, agences, devis). **Vision produit v2** : [`docs/PRD_TRAVEL_LEAD_DESK_V2.md`](docs/PRD_TRAVEL_LEAD_DESK_V2.md). Détails complémentaires : [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).

Paquet de contexte pour audit / brainstorming (stack, archi, **UI / design**, données, prompts) : **[docs/audit-claude-pro/README.md](docs/audit-claude-pro/README.md)** — fichier unique pour outils sans sous-dossiers Git : **[docs/CLAUDE_AUDIT_CONTEXT.md](docs/CLAUDE_AUDIT_CONTEXT.md)** — détail visuel (tokens, layout, panneaux) : **[docs/audit-claude-pro/UI_LAYOUT_AND_VISUAL.md](docs/audit-claude-pro/UI_LAYOUT_AND_VISUAL.md)**.

## Déploiement (GitHub + Vercel)

Procédure détaillée : **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** (dépôt GitHub, variables Vercel, redirections Supabase, domaine).

Variables d’environnement : copier `.env.example` vers `.env.local` ; sur Vercel, reprendre les clés listées dans `.env.example` (dont `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`, optionnel `INTAKE_SHARED_SECRET` pour l’intake public).

### API publique — intake formulaire (Squarespace)

- **Route** : `POST /api/intake` — [`src/app/api/intake/route.ts`](src/app/api/intake/route.ts) (JSON, idempotence par `submission_id`, client **service_role**).
- **CORS** : en prod, `ALLOWED_ORIGIN` = URL exacte de la page du formulaire ; tu peux en mettre plusieurs séparées par une virgule (avec et sans `www`).
- **Optionnel** : `INTAKE_SHARED_SECRET` + en-tête `Authorization: Bearer …` ou `X-Intake-Secret`.
- **Formulaire Squarespace** (alerte validation alors que tout est rempli) : [docs/SQUARESPACE_FORM_INTAKE.md](docs/SQUARESPACE_FORM_INTAKE.md).

---

## Développement local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) (redirection login ou dashboard selon la session).

## Déploiement

Voir **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** et la doc Next.js [Deploying](https://nextjs.org/docs/app/building-your-application/deploying).
