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

1. Appliquer toutes les migrations sur le **même** projet que les clés API : `supabase db push` ou copier-coller les fichiers `supabase/migrations/*.sql` dans l’éditeur SQL (ordre chronologique des fichiers).
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
   Reprendre les valeurs du dashboard Supabase → Settings → API (clé **anon** uniquement ; ne pas mettre `service_role` dans Vercel).

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
