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

Champs requis côté API : **nom résolu** (plein ou prénom+nom), **email**, **submission_id** (idempotence).
