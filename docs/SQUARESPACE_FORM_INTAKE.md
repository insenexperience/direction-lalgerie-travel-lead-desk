# Formulaire Squarespace — intake et validation

## Alerte « Renseignez au minimum votre prénom, nom et email » alors que les champs sont remplis

Cette alerte vient du **JavaScript injecté dans Squarespace** (ou d’un bloc Code), pas de l’app Travel Lead Desk. Elle s’affiche quand le script lit des champs qui **n’existent pas** dans le DOM.

### Cause fréquente

L’étape contact du formulaire « programmer le voyage » utilise en pratique des champs du type :

- `name="first"` — prénom  
- `name="last"` — nom  
- `name="email"` — email  

Si la validation fait par exemple `formData.get("full_name")` ou `querySelector('[name="full_name"]')`, la valeur est **toujours vide** : d’où le message d’erreur même avec l’écran correctement rempli.

### Correction côté Squarespace

Adapter la vérification avant envoi / avant changement d’étape, par exemple :

```js
function readContact(root) {
  const q = (name) => root.querySelector(`[name="${name}"]`);
  const v = (name) => (q(name)?.value ?? "").trim();
  const first = v("first");
  const last = v("last");
  const email = v("email");
  return { first, last, email, full_name: [first, last].filter(Boolean).join(" ").trim() };
}

function validateContactStep(root) {
  const { first, last, email } = readContact(root);
  if (!first || !last || !email) {
    window.alert("Renseignez au minimum votre prénom, nom et email.");
    return false;
  }
  return true;
}
```

Lors du `POST` JSON vers l’API Travel Lead Desk (`/api/intake`), tu peux envoyer soit **`full_name`**, soit **`first` + `last`** (l’API les fusionne).

### Côté API (dépôt)

La route `POST /api/intake` accepte désormais un nom dérivé de `first` / `last` (et quelques alias courants) si `full_name` est absent — voir `resolveFullNameFromIntakeBody` dans `src/lib/intake-lead-insert.ts`.

Champs requis côté API : **nom résolu** (plein ou prénom+nom) et **email**.  
**`submission_id`** est optionnel : s’il est absent, le serveur en génère un (l’idempotence ne s’applique que si le client envoie un `submission_id` stable, ex. même valeur pour tout le parcours du formulaire).

---

## Le lead n’apparaît pas dans l’outil

1. **Outils développeur du navigateur** (F12) → onglet **Réseau** → filtrer `intake` ou ton domaine Vercel. Au submit, tu dois voir un `POST` vers `…/api/intake` avec statut **201** (`created`) ou **200** (`already_received`).  
   - **401** : sur Vercel, `INTAKE_SHARED_SECRET` est défini mais le `fetch` n’envoie pas `Authorization: Bearer …` ni `X-Intake-Secret`. Soit retirer la variable, soit ajouter l’en-tête dans le code Squarespace.  
   - **403** : `ALLOWED_ORIGIN` ne correspond pas à l’**Origin** exacte de la page (ex. `https://www…` vs `https://…` sans `www`). Sur Vercel, mets les deux dans `ALLOWED_ORIGIN` séparées par une **virgule**.  
   - **422** : email manquant ou nom non résolu (vérifier `email`, `full_name` ou `first`+`last` dans le JSON).  
   - **500** : erreur serveur / Supabase (souvent migration ou colonne manquante) — regarder les **logs** de la fonction sur Vercel → projet → Deployments → fonction `/api/intake`.

2. **URL du `POST`** : doit pointer vers l’instance qui a `SUPABASE_SERVICE_ROLE_KEY` et les migrations à jour (ex. `https://direction-lalgerie-travel-lead-desk.vercel.app/api/intake` ou ton domaine custom).

3. **Côté outil** : les leads **sans référent** (`referent_id` null) restent visibles pour toute l’équipe (politique RLS « pool »). Rafraîchir la liste **Leads** après un envoi réussi.
