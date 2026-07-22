# SPEC — Page voyageur de requalification (`/q/<token>`)

> **Statut :** design validé par Mehdi le 2026-07-22 (session Claude Code).
> **Plan d'exécution :** [`PLAN_PAGE_VOYAGEUR_REQUALIFICATION.md`](./PLAN_PAGE_VOYAGEUR_REQUALIFICATION.md)
> **Déclencheur :** premier lead réel (DA-2026-0001, famille 3 pax, départ 2026-08-20). La qualification par email à 6 questions est remplacée par une page web brandée, plus simple pour le voyageur et plus professionnelle.

---

## 1. Objectif

Permettre à un voyageur de compléter la qualification de son projet via une page personnelle `https://voyage.directionlalgerie.com/q/<token>`, au lieu de répondre à un long email. Les réponses alimentent le lead dans le desk ; l'opérateur les valide ensuite bloc par bloc (mécanique `qualification_blocks` existante, inchangée).

## 2. Parcours

1. **Opérateur** (cockpit lead) : clique « Lien voyageur » → token généré → copie `https://voyage.directionlalgerie.com/q/<token>` dans son email au client (envoi manuel depuis la boîte DA).
2. **Voyageur** : ouvre la page (mobile-first) → voit SA page projet : logo DA, référence (`DA-YYYY-NNNN`), synthèse du projet, note de saison, formulaire 6 sections → envoie → écran de remerciement (« première proposition sous quelques jours » + WhatsApp DA).
3. **Desk** : réponses stockées sur le lead, horodatées ; panneau lecture seule « Réponses voyageur » dans le cockpit ; notification email interne si Resend configuré (dégradé silencieux sinon).

## 3. Données (migration)

4 colonnes sur `public.leads` — pas de nouvelle table :

| Colonne | Type | Rôle |
|---|---|---|
| `public_token` | `uuid` UNIQUE NULL | Accès public à la page ; index unique |
| `public_token_expires_at` | `timestamptz` NULL | Expiration (30 jours à la génération) |
| `traveler_responses` | `jsonb` NULL | Réponses structurées (schéma §5) |
| `traveler_responses_submitted_at` | `timestamptz` NULL | Horodatage soumission (null = pas encore soumis / réouvert) |

RLS : aucun ajout — l'accès public passe exclusivement par le service role côté serveur (pattern `/api/intake`). Les policies existantes de `leads` continuent de régir le dashboard.

## 4. Règles token

- Généré par server action opérateur (`randomUUID()`), validité 30 jours.
- **Régénérer** : remplace le token, prolonge l'expiration, et **remet `traveler_responses_submitted_at` à `null`** (réouvre la soumission) en conservant `traveler_responses` (pré-remplissage du formulaire).
- Une seule soumission par token actif : `POST` refuse (`409`) si `traveler_responses_submitted_at` non null.
- Token invalide/expiré → page « Lien expiré » avec contact WhatsApp DA (pas de détails sur le lead).

## 5. Schéma des réponses (`traveler_responses` JSONB)

Les ids d'options réutilisent **exactement** ceux de `qualification-blocks-config.ts` quand ils existent (permettra l'auto-application v2). Champs libres bornés à 500 caractères.

```jsonc
{
  "version": 1,
  "travelers": [{ "age": 42 }, { "age": 40 }, { "age": 9 }],   // 1..8 entrées, age 0..110
  "rooms": "two_rooms",             // two_rooms | triple | suite | advise
  "passports": ["algerian", "both", "french"],                  // par voyageur : algerian | french | both | other
  "flights": {
    "mode": "include",              // include | already_booked | self_managed
    "departure_city": "Paris"       // texte libre court
  },
  "wishes": {
    "must_see": ["casbah", "tipaza", "constantine"],            // ids grille highlights.must_see
    "rhythm": "balanced",           // intense | slow | balanced (ids grille vibes.pace)
    "structure": "flexible",        // fixed | flexible | full_trust (ids grille vibes.structure)
    "family_days": "3 jours chez la famille à Tizi",            // texte libre
    "notes": ""                     // texte libre
  },
  "business": { "mode": "curiosity", "details": "" },           // none | curiosity | meetings
  "constraints": {
    "diet": ["halal"],              // ids grille highlights.constraints (sous-ensemble alimentaire + mobilité)
    "accompaniment": "full_guide",  // full_guide | partial | advise
    "board": "half_board",          // breakfast | half_board | mixed | advise
    "notes": ""                     // texte libre (santé, mobilité, autres)
  }
}
```

Validation serveur stricte : enums en whitelist, ids grille vérifiés contre `getAllOptionIds()`, longueurs bornées, types vérifiés. Tout payload non conforme → `422`.

## 6. API publique

Deux handlers dans `src/app/api/q/[token]/route.ts` (runtime nodejs, service role, même origine — pas de CORS) :

- `GET /api/q/<token>` → `200 { summary, alreadySubmitted, existingResponses }` | `404` (token inconnu) | `410` (expiré).
  `summary` = référence, nom voyageur, ligne dates, voyageurs, style, budget, résumé projet. **Jamais** email ni téléphone.
- `POST /api/q/<token>` body = `traveler_responses` → `200 { ok: true }` | `404`/`410` | `409` (déjà soumis) | `422` (payload invalide).
  Effets : update `traveler_responses` + `traveler_responses_submitted_at`, `revalidatePath` des vues leads, notification Resend best-effort.

La page RSC `/q/[token]` lit directement en service role côté serveur (pas d'appel HTTP interne) ; seul le POST du formulaire passe par l'API.

## 7. Page publique

- Routes : `src/app/q/[token]/page.tsx` (RSC, `force-dynamic`) + `traveler-form.tsx` (client) + `src/app/q/layout.tsx` (layout public minimal, sans chrome dashboard).
- Design : tokens DA de `src/app/globals.css` (`--steel #182b35`, Cormorant Garamond pour le display, Poppins pour l'UI), logo `DIRECTION_ALG_LOGO_URL` (`src/lib/brand-assets.ts`) sur bandeau steel. Mobile-first, une page à scroll (pas de wizard).
- Contenu : bandeau brand + référence · carte synthèse projet · note de saison (Nord fin août ; options Grand Sud badgées « saison oct–avril ») · 6 sections de formulaire (voyageurs & âges & chambres · passeports · vols · envies & rythme · business · contraintes & accompagnement) · bouton « Envoyer mes réponses » · écran merci.
- Formulaire data-driven : configuration `TRAVELER_FORM_SECTIONS` (labels FR) rendue par des widgets génériques (chips multi, radio-cartes, champs texte) — pattern analogue à `qualification-blocks-config.ts`.
- Pré-remplissage : si `existingResponses` non null (lien régénéré), le formulaire repart de ces valeurs.

## 8. Cockpit (2 touches)

- **Bouton « Lien voyageur »** (`traveler-link-button.tsx`, monté dans `LeadCockpitDossier`) : appelle la server action `generateTravelerLink(leadId)` → affiche l'URL + bouton copier ; si un lien existe : le montre + « Régénérer ».
- **Panneau « Réponses voyageur »** (`traveler-responses-panel.tsx`, monté dans `LeadCockpitDossier` sous la fiche) : lecture seule, horodatage, rendu par section avec les labels FR ; visible seulement si `traveler_responses` non null. Pas d'auto-application aux blocs en v1.

## 9. Middleware & domaine

- `voyage.directionlalgerie.com` ajouté comme domaine du projet Vercel existant (CNAME chez le registrar/Squarespace DNS).
- `middleware.ts` : si host commence par `voyage.` → seuls `/q/*` et `/api/q/*` sont servis, tout le reste redirige `308` vers `https://www.directionlalgerie.com`. Les chemins `/q/*` et `/api/q/*` bypassent `updateSession` (aucune session requise). Le reste du comportement est inchangé.
- Env : `NEXT_PUBLIC_TRAVELER_BASE_URL=https://voyage.directionlalgerie.com` (utilisée pour construire le lien affiché à l'opérateur ; fallback = host de la requête).

## 10. Sécurité & vie privée

- Token uuid v4 (128 bits), vérifié serveur uniquement, expirant.
- La page publique n'expose jamais email/téléphone du voyageur ; la clé service role reste côté serveur (RSC + route API).
- Textes libres échappés par React au rendu ; longueurs bornées côté serveur.

## 11. Hors périmètre v1 (volontaire)

- Auto-application des réponses aux `qualification_blocks` (v2 — les ids sont déjà alignés).
- Multi-langue, édition post-soumission côté voyageur, page racine du sous-domaine, insert dans `activities`, rate-limiting dédié.

## 12. Remise en route infra (contexte au 2026-07-22)

À faire avant/avec le déploiement de cette feature (détail en Phase B du plan) :

- Vercel n'est **pas** connecté au domaine `directionlalgerie.com` (aucun domaine custom configuré sur le projet desk).
- « Rebrancher » le Travel Lead Desk : vérifier build GitHub→Vercel, variables d'env prod, Auth URLs Supabase.
- Vérifier que les 26 migrations `supabase/migrations/` sont appliquées sur le projet Supabase de prod.
- Bug connexe connu : l'intake Squarespace `POST /api/intake` n'a pas créé le lead du 2026-07-22 (diagnostic séparé ; probablement lié aux env `INTAKE_SHARED_SECRET`/`ALLOWED_ORIGIN` ou au branchement du formulaire).

## 13. Critères d'acceptation

1. Depuis le cockpit d'un lead, l'opérateur génère et copie un lien voyageur.
2. Le lien s'ouvre sur mobile sans authentification, affiche la synthèse du bon lead, jamais ses coordonnées.
3. La soumission écrit les réponses sur le lead, horodatées, visibles dans le cockpit ; une deuxième soumission est refusée ; la régénération du lien réouvre la soumission avec pré-remplissage.
4. Token inconnu/expiré → page dégradée propre, sans fuite d'information.
5. Sur `voyage.directionlalgerie.com`, seules les routes `/q/*` répondent ; le desk reste inaccessible depuis ce host.
6. `npm run build` et `npm run lint` passent ; parcours complet vérifié en navigateur (génération → soumission → cockpit).
