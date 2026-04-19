# Règles produit (résumé)

**Spec complète** : [docs/PRODUCT_SPEC.md](../PRODUCT_SPEC.md) — ce fichier ne fait que rappeler l’essentiel pour cadrer un audit ou une session de brainstorming.

## Vision

Outil interne de **gestion de leads voyage** : capter la demande, qualifier, affiner, consulter des agences en marque blanche, co-construire, produire un **devis consolidé** Direction l’Algérie, l’envoyer au voyageur.

## Règle non négociable

Le **voyageur ne communique jamais directement** avec l’agence partenaire. Direction l’Algérie est l’interface unique, le filtre et le chef d’orchestre.

Toute évolution fonctionnelle doit préserver (ou explicitement débattre) ce principe.

## Rôles métier (rappel)

- **Référent lead** : pilote un dossier de la qualification au devis voyageur ; assignation des leads pour distinguer les opérateurs.
- **Admin** : paramétrage, visibilité élargie (détail exact en itération — voir spec §7.1).
- Accès **agence** côté outil : hors scope initial si tout reste interne (à trancher plus tard).

## Modules décrits dans la spec (pour priorisation)

Dashboard, leads (liste + détail), qualification, évolution du besoin, agences, consultations, co-construction, devis, envoi voyageur, métriques, utilisateurs, réglages — voir sections 7.x de la spec.

## Développement (contexte équipe)

Approche itérative, petites tâches, spec structurée pour copilote IA ; le détail technique (RLS exacte, matrice droits) est censé s’affiner au fil des itérations — la spec en fixe les **fondations métier**.
