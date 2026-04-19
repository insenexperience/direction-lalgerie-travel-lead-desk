# Déploiement — GitHub + Vercel + Supabase

Guide ciblé **Direction l’Algérie — Travel Lead Desk** (Next.js App Router, auth Supabase, migrations SQL versionnées).

---

## 1. GitHub

1. Créer un dépôt vide sur GitHub (privé recommandé : données voyageurs / CRM).
2. En local, à la racine du projet :

```bash
git init
git branch -M main
git remote add origin https://github.com/<org>/<repo>.git
git add .
git commit -m "Initial commit"
git push -u origin main
```

Si le dépôt existe déjà : `git remote -v` puis `git push`.

---

## 2. Base Supabase (avant prod)

1. Appliquer **toutes** les migrations sur le **même** projet que les clés `NEXT_PUBLIC_SUPABASE_*` (sinon erreur type `column leads.intake_channel does not exist` au chargement d’une fiche lead).

   **Option A — CLI** (recommandé si le projet est lié) :

   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref <ton-project-ref>
   npm run db:push
   ```

   **Option B — SQL Editor** (dashboard Supabase → **SQL** → **New query**) : exécuter le contenu des fichiers du dossier `supabase/migrations/` **dans l’ordre des préfixes de date** (du plus ancien au plus récent). Pour corriger rapidement une base « ancienne » déjà en prod, les fichiers **v2** indispensables côté app actuelle sont au minimum :

   - `20260428100000_travel_lead_desk_v2.sql` (colonnes `leads` / `agencies` / `lead_circuit_proposals` / `quotes`, index, suppression CRM / `lead_snapshots`)
   - `20260428120000_quote_pdfs_bucket.sql` (bucket Storage `quote_pdfs` pour l’envoi devis WhatsApp)
   - `20260429100000_lead_workflow_v3_iter1.sql` (colonnes workflow PRD v3 sur `public.leads`)

   Réf. produit : [`PRD_TRAVEL_LEAD_DESK_V2.md`](./PRD_TRAVEL_LEAD_DESK_V2.md).
2. **Authentication → URL configuration** (à mettre à jour après la première URL Vercel) :
   - **Site URL** : `https://<ton-domaine-prod>` (ou l’URL Vercel temporaire le temps des tests).
   - **Redirect URLs** : inclure au minimum  
     - `http://localhost:3000/**`  
     - `https://*.vercel.app/**` (previews Vercel)  
     - `https://<ton-domaine-prod>/**`  
   Sans ça, la connexion email/mot de passe peut échouer après redirection.

---

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → importer le dépôt GitHub.
2. **Framework Preset** : Next.js (détecté). **Root Directory** : `.` (racine).
3. **Build Command** : `npm run build` (déjà défini dans `package.json`, utilise Webpack pour la build).
4. **Install Command** : `npm install` (défaut).
5. **Environment Variables** (Production **et** Preview) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   Reprendre les valeurs du dashboard Supabase → Settings → API (clé **anon** uniquement pour les variables `NEXT_PUBLIC_*`).
   - **v2 (serveur uniquement, ne jamais préfixer `NEXT_PUBLIC_`)** : `OPENAI_API_KEY`, `OPENAI_MODEL`, clés WhatsApp (`WHATSAPP_API_TOKEN` ou `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` pour la signature `X-Hub-Signature-256`), et `SUPABASE_SERVICE_ROLE_KEY` pour webhooks publics, stockage devis (`quote_pdfs`), route **`/api/intake`** (formulaire Squarespace) et autres opérations serveur. La `service_role` ne doit pas être exposée au navigateur.
   - **`ALLOWED_ORIGIN`** : origine(s) CORS pour `POST /api/intake` en prod (ex. `https://www.directionlalgerie.com`). Tu peux lister **plusieurs** origines séparées par une virgule si le site est servi avec et sans `www`. En dev, l’API répond avec `Access-Control-Allow-Origin: *`.
   - **`INTAKE_SHARED_SECRET`** (optionnel) : si défini sur Vercel, le `POST` depuis Squarespace doit envoyer `Authorization: Bearer <secret>` ou `X-Intake-Secret: <secret>` (à configurer dans le code embarqué Squarespace / proxy).
   - **Workflow voyageur (PRD v3)** : `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_DA_CONTACT_EMAIL`, `NEXT_PUBLIC_WHATSAPP_DA_NUMBER` (indicatif pays + numéro, chiffres uniquement pour le lien WhatsApp).
   - Validation / champs du formulaire vitrine : **[docs/SQUARESPACE_FORM_INTAKE.md](SQUARESPACE_FORM_INTAKE.md)** (ex. alerte « prénom, nom et email » alors que les champs sont remplis).

6. Déployer : **Deploy**. Les **Preview** reçoivent une URL `https://<projet>-<hash>.vercel.app` : ajoute-la (ou le motif `https://*.vercel.app/**`) dans les Redirect URLs Supabase.

---

## 4. Domaine personnalisé (ex. sous-domaine + Squarespace DNS)

1. Vercel → projet → **Settings → Domains** → ajouter `desk.tondomaine.com` (exemple).
2. Suivre l’assistant Vercel (souvent un **CNAME** vers `cname.vercel-dns.com` depuis le DNS géré par Squarespace ou ton registrar).
3. Mettre à jour **Supabase Site URL** et **Redirect URLs** avec l’URL HTTPS définitive.

Le site vitrine peut rester sur la racine du domaine ; l’outil interne sur un **sous-domaine** évite les conflits avec Squarespace.

---

## 5. Après chaque merge sur `main`

Vercel redéploie automatiquement si l’intégration GitHub est active. Vérifier les **Deployments** et les logs de build en cas d’erreur.

---

## 6. Checklist rapide

| Élément | OK ? |
|--------|------|
| Migrations Supabase appliquées | |
| Variables `NEXT_PUBLIC_*` sur Vercel (prod + preview) | |
| Redirect URLs Supabase (local + Vercel + domaine final) | |
| Test login sur l’URL de preview | |
| Domaine custom + HTTPS sur Vercel | |
