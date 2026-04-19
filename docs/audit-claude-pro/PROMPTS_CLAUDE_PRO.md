# Modèles de prompts (Claude Pro)

Copier-coller et adapter les sections entre `---`. Joindre ou résumer le dossier `docs/audit-claude-pro/` + chemins de fichiers pertinents.

---

## 1. Audit sécurité (RLS + surface API)

Tu es un auditeur sécurité sur une app Next.js 16 + Supabase.

Contexte : [STACK.md](./STACK.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DATA_SUPABASE.md](./DATA_SUPABASE.md), migrations dans `supabase/migrations/`.

Tâches :

1. Lister les policies RLS actives par table et détecter conflits ou sur-permissions (ex. pool SELECT vs restrictions référent).
2. Vérifier que chaque server action dans `src/app/(dashboard)/*/actions.ts` ne s’appuie pas uniquement sur l’UI pour la sécurité.
3. Analyser la route `src/app/api/leads/[leadId]/quotes/[quoteId]/pdf/route.tsx` : contrôle d’accès, fuite de données, IDs exposés.

Livrable : tableau risques (gravité / proba), recommandations concrètes, ordre de patch suggéré.

---

## 2. Revue performance (RSC + dynamique)

Contexte : layout dashboard avec `force-dynamic` / `revalidate = 0`, middleware Supabase sur presque toutes les routes.

Tâches :

1. Identifier les pages ou layouts qui pourraient être partiellement statiques ou mis en cache sans casser la session.
2. Proposer une stratégie mesurée (sans sur-ingénierie) pour réduire le coût par requête sur Vercel.

Livrable : liste courte d’hypothèses à valider avec profiling + changements ciblés.

---

## 3. Brainstorm fonctionnalités (aligné produit)

Règles : [PRODUCT_RULES_SUMMARY.md](./PRODUCT_RULES_SUMMARY.md) et spec complète `docs/PRODUCT_SPEC.md`.

Périmètre actuel : [ROUTES_AND_FEATURES.md](./ROUTES_AND_FEATURES.md).

Demande : proposer 5 à 10 améliorations produit **compatibles avec la règle « voyageur ne parle pas à l’agence »**, classées par impact / effort, avec critères d’acceptation.

---

## 4. Checklist pré-production

À partir de [OPS_ENV.md](./OPS_ENV.md) et [DEPLOY_VERCEL.md](../DEPLOY_VERCEL.md), produire une checklist binaire (oui/non) couvrant : env Vercel, redirect URLs, migrations appliquées, compte admin, test login preview, test PDF devis, sauvegardes / PRA (si applicable).

---

## 5. Revue data model

À partir des migrations SQL, suggérer : index manquants, contraintes d’intégrité, idempotence des imports intake (`submission_id`), évolution propre des enums (CRM, workflow devis).

Livrable : backlog technique priorisé.
