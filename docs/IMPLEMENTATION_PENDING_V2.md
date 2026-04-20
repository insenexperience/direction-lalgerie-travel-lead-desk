# Implémentation — état au 2026-04-20

## ✅ Complété

### Refonte UI/UX (branche `main`, commit `cda2af4`)
- Nouvelle inbox opérateur `/inbox` avec queues filtrables (chips)
- Cockpit lead 3 colonnes (`lead-cockpit-shell.tsx`)
- Pipeline visuel `LeadRail` + `NextActionCard`
- Dashboard Pilotage business (KPI cards, entonnoir, revenue bars)
- Liste leads refondue (tabs + hover actions)
- Primitives UI : `StageDot`, `Pill`, `Chip`, `KpiCard`, `Avatar`
- Sidebar 2 sections + badges compteurs
- Redirect root → `/inbox`

### Workspace Qualification (branche `feat/qualification-workspace`, mergé `main`, commit `a12ea57`)
- Composant `LeadQualificationWorkspace` — champs structurés + zone narrative libre
- Agent IA `runQualificationAgent` (Claude Haiku via API Anthropic directe)
- `saveQualificationFields` + `validateQualification` server actions
- Migration `20260420200000` : colonnes `travel_desire_narrative`, `destination_main`, `qualification_notes`
- Données démo : agence Sahara Explorers + lead Karim Benali
- Variable `ANTHROPIC_API_KEY` documentée dans `.env.example`

### Infrastructure déjà en place
- Auth Supabase + RLS (`RLS_PROD_CHECKLIST.md`)
- Workflow voyageur : `launchWorkflowAi`, `launchWorkflowManual`, `resetWorkflowVoyageurSession`
- Intake web form (`POST /api/intake`) + webhook WhatsApp
- Génération PDF devis (`@react-pdf/renderer`)
- Co-construction + shortlist agences IA (`generateAgencyShortlist`, `compareAgencyProposals`)

---

## 🔲 Reste à faire

### Priorité haute
- **`triggerQualificationConversation`** non branché — existe dans `ai-actions.ts` mais aucun flux ne l'appelle (voir conflit C7 dans `USER_JOURNEYS.md`). Décider : brancher post-lancement workflow ou déprécier.
- **Variables Vercel à configurer en prod** :
  - `ANTHROPIC_API_KEY` — agent qualification IA
  - `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — emails workflow voyageur
  - `WHATSAPP_*` — webhook inbound + envoi messages
  - `OPENAI_API_KEY` — shortlist agences + comparaison propositions

### Phase 4 — Polish (prévu, non implémenté)
- Empty states animés (inbox vide, liste vide)
- Skeletons de chargement (inbox items, KPI cards, cockpit colonnes)
- Export CSV liste leads
- Raccourcis clavier inbox (↑↓ navigation, V valider, A assigner)

### Améliorations mineures
- `lead-fiche-modifier.tsx` supprimé — vérifier qu'aucun import résiduel ne manque
- Score lead `A+/A/B+/B/C` affiché dans cockpit colonne 3 (scoreboard) — logique présente, affichage à finaliser
- SLA chronologie cockpit — colorisation warn/hot si < 2h restantes
