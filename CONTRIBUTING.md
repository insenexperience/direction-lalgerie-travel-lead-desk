# Contribuer au Travel Lead Desk

## PR checklist (parcours & leads)

Si votre PR touche l’un des points suivants, **mettez à jour** [`docs/USER_JOURNEYS.md`](docs/USER_JOURNEYS.md) dans la **même PR** (diagrammes, tableau des conflits, ou entrée **Changelog parcours**), sauf urgence documentée (PR de suivi sous 48 h + todo) :

- Statuts pipeline ou transitions (`updateLeadStatus`, `moveLeadPipelineStep`, garde-fous)
- Workflow voyageur IA / manuel, reset session, `manual_takeover`
- Gate brief / qualification (`lead-brief-gate`, `assertBriefExploitableBeforeAgencyAssignment`)
- Référent, `claimLead` / `assignLeadReferent`
- Intake ou webhooks créant ou modifiant des `leads`
- Politiques RLS affectant la visibilité ou les actions sur les leads

La spec produit détaillée reste dans [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) ; les **flux et garde-fous** doivent rester synchrones avec [`docs/USER_JOURNEYS.md`](docs/USER_JOURNEYS.md).

## Commandes utiles

```bash
npm run dev
npm run build
npm run lint
npm run db:push
```
