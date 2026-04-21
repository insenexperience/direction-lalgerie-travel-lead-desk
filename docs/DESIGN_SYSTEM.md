# Design System — Direction l'Algérie Travel Lead Desk

Référence complète pour tout agent IA (Claude Design ou autre) chargé de produire ou modifier de l'UI dans ce projet. Chaque valeur est extraite directement du code source actuel — aucune interpolation.

---

## Table des matières

1. [Principes](#1-principes)
2. [Tokens de couleur](#2-tokens-de-couleur)
3. [Typographie](#3-typographie)
4. [Espacement, radii & z-index](#4-espacement-radii--z-index)
5. [Composants UI atomiques](#5-composants-ui-atomiques)
6. [Composants domaine Lead — atomiques](#6-composants-domaine-lead)
7. [Navigation & layout global](#7-navigation--layout-global)
8. [États interactifs](#8-états-interactifs)
9. [Responsive](#9-responsive)
10. [Accessibilité](#10-accessibilité)
11. [Patterns UX](#11-patterns-ux)
12. [Pipeline Lead — logique complète](#12-pipeline-lead--logique-complète)
13. [Composants pipeline — détail exhaustif](#13-composants-pipeline--détail-exhaustif)

---

## 1. Principes

| Principe | Application concrète |
|---|---|
| **Premium & sobre** | Pas d'ornements. La couleur porte le sens (statut, urgence, succès). |
| **Information-dense** | Tableaux compacts, labels minuscules, pas d'espaces vides gratuits. |
| **Tokens only** | Toutes les couleurs passent par des variables CSS. Jamais de hex en dur dans un composant. |
| **Mobile-first, desktop-optimisé** | UI critique (cockpit lead) conçue pour `lg:`, utilisable en mobile. |
| **Français** | Toute l'interface est en français — libellés, labels, tooltips. |

---

## 2. Tokens de couleur

Définis dans `src/styles/globals.css` via `@theme inline`. Utilisables en Tailwind comme `text-steel`, `bg-panel-muted`, etc.

### Palette de marque

| Token CSS | Valeur hex | Tailwind | Usage |
|---|---|---|---|
| `--steel` | `#15323f` | `steel` | Accent principal — nav active, boutons CTA primaires, rails pipeline |
| `--steel-ink` | `#f3f7fa` | `steel-ink` | Texte sur fond steel |

### Surfaces & fond

| Token CSS | Valeur hex | Alias Tailwind | Usage |
|---|---|---|---|
| `--bg` | `#f6f7f8` | `background` | Fond de page global |
| `--surface` | `#ffffff` | `panel` | Fond de carte/composant |
| `--panel-muted` | `#f4f7fa` | `panel-muted` | Sections secondaires, inputs, badges |
| `--line` | `#e4e8eb` | `border` | Bordures par défaut |

### Échelle ink (texte)

| Token CSS | Valeur hex | Alias Tailwind | Usage |
|---|---|---|---|
| `--ink` | `#0e1a21` | `foreground` | Titres, texte principal |
| `--ink-2` | `#3a4a55` | — | Texte secondaire, valeurs de champs |
| `--ink-3` | `#6b7a85` | `muted-foreground` | Placeholders, metadata |
| `--ink-4` | `#9aa7b0` | — | Labels uppercase, métadonnées très secondaires |

### Couleurs sémantiques

| Token CSS | Valeur hex | Sémantique | Usage |
|---|---|---|---|
| `--revenue` | `#0f6b4b` | Succès / positif | Statut won, deltas positifs, grade A |
| `--hot` | `#c1411f` | Urgence / négatif | Statut lost, priorité haute, grade C |
| `--warn` | `#a8710b` | Avertissement | Statut negotiation/co_construction |
| `--info` | `#1e5a8a` | Information | Statut qualification |
| `--gold` | `#b68d3d` | Highlight | Statut agency_assignment, avatar gold |

### Règle absolue

> La couleur sémantique n'est **jamais** utilisée pour une raison esthétique. `--revenue` (vert) = succès métier. `--hot` (rouge) = urgence métier. Les utilisateurs lisent ces couleurs comme des signaux.

### Palette de statut lead

| Statut | Couleur dot | Hex |
|---|---|---|
| `new` | ink-3 | `#6b7a85` |
| `qualification` | info | `#1e5a8a` |
| `agency_assignment` | gold | `#b68d3d` |
| `co_construction` | warn | `#a8710b` |
| `quote` | steel | `#15323f` |
| `negotiation` | warn | `#a8710b` |
| `won` | revenue | `#0f6b4b` |
| `lost` | hot | `#c1411f` |

---

## 3. Typographie

### Familles

| Variable CSS | Police | Fallbacks | Usage |
|---|---|---|---|
| `--font-inter` | Inter | system-ui, Segoe UI | UI générale — `font-sans` |
| `--font-jetbrains` | JetBrains Mono | Fira Code | IDs, références, valeurs numériques — `font-mono` |

JetBrains Mono utilise `font-variant-numeric: tabular-nums` (alignement tabulaire des chiffres).

### Base du body

- Taille : `14px`
- Line-height : `1.45`
- Anti-aliasing : classe `antialiased` sur `<html>`

### Échelle typographique (extraite des composants)

| Taille | Classe Tailwind | Poids typique | Usage |
|---|---|---|---|
| 9px | `text-[9px]` | bold | Initiales avatar 22px |
| 10px | `text-[10px]` | semibold | Labels section uppercase `tracking-widest` |
| 11px | `text-[11px]` | medium | Pills, badges, metadata compacte, sidebar badge |
| 12px | `text-[12px]` | medium/semibold | Valeurs de champs, boutons CTA, nav links |
| 13px | `text-[13px]` | medium | Corps compact, nav links sidebar |
| 14px | `text-sm` | regular | Corps standard |
| 18px | `text-[18px]` | semibold | Score numérique (font-mono) |
| 19px | `text-[19px]` | semibold | Titre de page (`<h1>`) |
| 22px | `text-[22px]` | semibold | Titre cockpit lead |
| 28px | `text-[28px]` | semibold | Valeur KPI |
| 34px | `text-[34px]` | bold | Grade commercial (A+, B…) |

### Conventions

- **Labels de section** : `text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]`
- **Valeurs de champ** : `text-[12px] font-medium text-[#3a4a55]`
- **Titres de carte** : `text-[13px] font-semibold text-[#0e1a21]`
- **Références/IDs** : `font-mono text-[11px]` + `tabular-nums`
- **Boutons CTA** : `text-[12px] font-semibold`

---

## 4. Espacement, radii & z-index

### Border-radius

| Valeur | Classe | Usage |
|---|---|---|
| 0 | `rounded-none` | Lead status badge |
| 4px | `rounded-[4px]` | Pills, petits badges |
| 6px | `rounded-[6px]` | Chips, boutons, nav items |
| 8px | `rounded-[8px]` | Cartes, panels principaux |
| `0.375rem` | `rounded-md` | Inputs, textareas, dialogs internes |
| `0.5rem` | `rounded-lg` | Dialogs, modales |
| `9999px` | `rounded-full` | Avatars, dots, score bars |

### Échelle de gap

`gap-1` → `gap-1.5` → `gap-2` → `gap-2.5` → `gap-3` → `gap-4` → `gap-6`

- `gap-1.5` : intérieur pills/badges
- `gap-2` : éléments de champ
- `gap-3` : éléments de nav
- `gap-4` : entre cartes

### Padding commun

| Contexte | Padding |
|---|---|
| Badge tight | `px-1.5 py-0.5` |
| Pill/badge | `px-2 py-0.5` |
| Bouton compact | `px-2.5 py-1.5` |
| Bouton standard | `px-3 py-1.5` |
| Bouton action | `px-3 py-2` |
| Section carte | `px-4 py-3` |
| Carte KPI | `p-5` |
| Page mobile | `px-4 py-5` |
| Page desktop | `lg:px-8 lg:py-8` |

### Z-index

| Couche | z-index | Composant |
|---|---|---|
| Topbar | 20 | `topbar.tsx` |
| Nav mobile | 40 | `dashboard-mobile-nav.tsx` |
| Dialogs / overlays | 50 | Sheets, modales |
| Search global | 100 | `global-search.tsx` |

---

## 5. Composants UI atomiques

### 5.1 Pill — `src/components/ui/pill.tsx`

Badge texte inline avec variante sémantique et dot optionnel.

```ts
variant: "neutral" | "revenue" | "hot" | "warn" | "info" | "steel"
dot?: boolean
children: ReactNode
className?: string
```

**Styles par variante**

| Variante | Fond | Texte | Bordure |
|---|---|---|---|
| `neutral` | `#f4f7fa` | `#3a4a55` | `#e4e8eb` |
| `revenue` | `#e6f4ee` | `#0f6b4b` | `#b8dece` |
| `hot` | `#fceee9` | `#c1411f` | `#f5c9bc` |
| `warn` | `#fdf3e2` | `#a8710b` | `#f0d49a` |
| `info` | `#e8f0f9` | `#1e5a8a` | `#bdd3ee` |
| `steel` | `#15323f` | `#f3f7fa` | transparent |

**Structure** : `inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-medium leading-tight`

**Dot** (quand `dot=true`) : `h-[5px] w-[5px] rounded-full bg-current opacity-70`

---

### 5.2 Avatar — `src/components/ui/avatar.tsx`

Cercle avec initiales générées (prénom[0] + nom[0]).

```ts
name: string
size: 22 | 30 | 34 | 44   // défaut: 34
gold?: boolean              // défaut: false
className?: string
```

| Taille | Classe | Usage typique |
|---|---|---|
| 22px | `h-[22px] w-[22px] text-[9px]` | Compact, listes |
| 30px | `h-[30px] w-[30px] text-[11px]` | Topbar |
| 34px | `h-[34px] w-[34px] text-[12px]` | Cartes |
| 44px | `h-[44px] w-[44px] text-[15px]` | Profil utilisateur |

**Couleurs** :
- Défaut : `bg-[#e4e8eb] text-[#3a4a55]`
- Gold : `bg-[#b68d3d] text-white`

**Structure** : `<span>` `rounded-full inline-flex items-center justify-center font-semibold leading-none`

---

### 5.3 Chip — `src/components/ui/chip.tsx`

Bouton toggle ou lien filtré, avec badge compteur optionnel.

```ts
href?: string
active?: boolean
count?: number
children: ReactNode
onClick?: () => void
```

**Structure** : `inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-[12px] font-medium transition-colors`

| État | Fond | Bordure | Texte |
|---|---|---|---|
| Actif | `#15323f` | `#15323f` | `#f3f7fa` |
| Inactif | `white` | `#e4e8eb` | `#3a4a55` |
| Hover inactif | `#f6f7f8` | `#15323f/30` | — |

**Badge count** : `rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none`
- Actif : `bg-white/20 text-white`
- Inactif : `bg-[#e4e8eb] text-[#6b7a85]`

---

### 5.4 KPI Card — `src/components/ui/kpi-card.tsx`

Carte de métrique dashboard.

```ts
label: string
value: ReactNode
delta?: number
deltaLabel?: string
href?: string
mono?: boolean
```

**Structure** : `flex flex-col gap-2 rounded-[8px] border border-[#e4e8eb] bg-white p-5`

- Label : `text-[11px] font-medium uppercase tracking-wider text-[#6b7a85]`
- Valeur : `text-[28px] font-semibold leading-none text-[#0e1a21]` (+ `font-mono` si `mono=true`)
- Delta positif : icône `TrendingUp` + `text-[#0f6b4b]`
- Delta négatif : icône `TrendingDown` + `text-[#c1411f]`
- Delta neutre : `text-[#6b7a85]`

---

### 5.5 Stage Dot — `src/components/ui/stage-dot.tsx`

Point coloré `7×7px` indiquant le statut pipeline.

`inline-block h-[7px] w-[7px] shrink-0 rounded-full`

Couleurs alignées sur la [palette de statut lead](#palette-de-statut-lead) (§2).

---

## 6. Composants domaine Lead

### 6.1 Lead Status Badge — `src/components/lead-status-badge.tsx`

Badge avec icône Lucide + label traduit. `rounded-none` — c'est intentionnel.

`inline-flex items-center gap-1.5 rounded-none border px-2 py-1 text-xs font-semibold`

| Statut | Fond | Texte | Bordure | Icône Lucide |
|---|---|---|---|---|
| `new` | `#f7fafc` | `#1c2b32` | `#d7dee5` | `Inbox` |
| `qualification` | `#eef2f6` | `#223842` | `#cfd8e0` | `ListChecks` |
| `agency_assignment` | `#dfe8ef` | `#152a35` | `#b8c6d2` | `Building2` |
| `co_construction` | `#d4e0ea` | `#0f1c24` | `#a8bac9` | `Users` |
| `quote` | `#f0f4f8` | `#1a3040` | `#d7dee5` | `FileText` |
| `negotiation` | `#eceff2` | `#3d4f5c` | `#dce3e9` | `Handshake` |
| `won` | `#e5f3ef` | `#1f5c4a` | `#b8dcc8` | `CheckCircle2` |
| `lost` | `#eef0f2` | `#5c6570` | `#d4d8dc` | `XCircle` |

---

### 6.2 Lead Score Pill — `src/components/leads/lead-score-pill.tsx`

Affiche score numérique + tier + barre de progression. Cliquable (ouvre modal détail).

```ts
lead: SupabaseLeadRow
onOpenModal: () => void
compact?: boolean
```

**Conteneur** : `inline-flex max-w-full items-center gap-2 rounded-md border border-[#e4e8eb] bg-[#f4f7fa] px-2 py-1 text-left transition-colors hover:bg-white`

**Tiers**

| Tier | Fond | Texte | Label |
|---|---|---|---|
| `cold` | `#e5e7eb` | `#3d3d3b` | Froid |
| `tepid` | `#fef3c7` | `#78350f` | Tiède |
| `warm` | `#fdf3e0` | `#8a5c1a` | Chaud |
| `hot` | `#fee2e2` | `#7a1f1f` | Très chaud |

**Barre** : `h-1.5 min-w-[2.5rem] max-w-[4rem] rounded-full bg-[#e4e8eb]` avec fill steel proportionnel au score.

---

### 6.3 Lead AI Status Pill — `src/components/leads/lead-ai-status-pill.tsx`

`inline-flex max-w-full min-w-0 items-center gap-2 rounded-md border border-[#e4e8eb] bg-[#f4f7fa] px-2 py-1 text-left transition-colors hover:bg-white`

| État | Couleur dot | Label |
|---|---|---|
| Non démarré | `bg-neutral-400` (#a3a3a3) | IA non démarrée |
| Suspendu | `bg-[#c47c20]` | IA suspendue |
| Actif | `bg-[#2d7a5f]` + `animate-pulse` | IA active |

Dot : `relative flex size-2 shrink-0 rounded-full`

---

### 6.4 Lead Rail — `src/components/leads/lead-rail.tsx`

Indicateur de progression pipeline horizontal. 7 étapes visibles.

**Étapes** (dans l'ordre) :
1. `new` → "Nouveau"
2. `qualification` → "Qualif."
3. `agency_assignment` → "Assignation"
4. `co_construction` → "Co-construct."
5. `quote` → "Devis"
6. `negotiation` → "Négociation"
7. `won` → "Gagné"

**Nœud actif** : `border-[#15323f] bg-[#15323f]` + point blanc central  
**Nœud terminé** : `border-[#15323f] bg-white` + icône check  
**Nœud futur** : `border-[#e4e8eb] bg-white` + stage dot  

**Connecteur** : `h-[2px]` — `bg-[#15323f]` si terminé, `bg-[#e4e8eb]` si futur

**Mode compact** : labels masqués, `min-w-[48px]`, connecteur `w-2`

---

### 6.5 Next Action Card — `src/components/leads/next-action-card.tsx`

CTA contextuel basé sur le statut du lead. Toujours visible dans le cockpit.

**Conteneur** : `rounded-[8px] border border-[#e4e8eb] bg-white p-4`

**Badge priorité** : `inline-flex w-fit items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold`

| Variante badge | Fond | Texte |
|---|---|---|
| `hot` | `#fceee9` | `#c1411f` |
| `warn` | `#fdf3e2` | `#a8710b` |
| `info` | `#e8f0f9` | `#1e5a8a` |
| `revenue` | `#e6f4ee` | `#0f6b4b` |
| `neutral` | `#f4f7fa` | `#3a4a55` |

**Bouton CTA** : `flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60`

---

### 6.6 Lead Cockpit Shell — `src/components/leads/lead-cockpit-shell.tsx`

Composant racine de la vue détail lead. Grille 3 colonnes sur desktop.

#### Grid desktop (`lg:`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header : titre lead + référence (font-mono) + pills statut  │
├─────────────────────────────────────────────────────────────┤
│ Lead Rail (pipeline progress horizontal)                    │
├─────────────────────────────────────────────────────────────┤
│ Next Action Card                                            │
├──────────────┬─────────────────────┬────────────────────────┤
│ Left 300px   │ Center (1fr)        │ Right 320px            │
│ Info voyageur│ Contenu tabs        │ Scoring + grade        │
│ Référent     │ (children)          │ SLA timeline           │
│ Contact      │                     │ Quick actions          │
└──────────────┴─────────────────────┴────────────────────────┘
```

Grid CSS : `lg:grid-cols-[300px_minmax(0,1fr)_320px]`

#### Cartes internes

`rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3`

#### Scoring (colonne droite)

- Label section : `text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]`
- Grade : `text-[34px] font-bold`

| Grade | Score | Couleur |
|---|---|---|
| A+ / A | ≥ 90 | `#0f6b4b` (revenue) |
| B+ | ≥ 60 | `#3a4a55` (ink-2) |
| B | ≥ 45 | `#a8710b` (warn) |
| C | < 45 | `#c1411f` (hot) |
| — | null | `#9aa7b0` (ink-4) |

#### Quick action buttons (colonne droite)

- Défaut : `border-[#e4e8eb] bg-white text-[#3a4a55] hover:border-[#15323f]/20 hover:bg-[#f6f7f8]`
- Danger : `border-[#f5c9bc] bg-white text-[#c1411f] hover:bg-[#fceee9]`
- Base : `flex w-full items-center gap-2 rounded-[6px] border px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-50`

---

### 6.7 Lead Cockpit Dossier — `src/components/leads/lead-cockpit-dossier.tsx`

Formulaire de consultation / édition du profil lead.

**Layout** : `md:grid-cols-2 xl:grid-cols-4 gap-4`

**4 sections** :
1. **Voyageur** — Nom, canal d'entrée, date de contact
2. **Voyage** — Dates, groupe, budget
3. **Qualification** — Score IA, confidence, validation manuelle
4. **Pilotage** — Référent, mode workflow, étape

**Champ lecture** :
- Label : `text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]`
- Valeur : `text-[12px] font-medium text-[#3a4a55]`

**Toggle édition** : `rounded-md border border-[#e4e8eb] bg-[#f4f7fa] px-3 py-2 text-sm`

---

## 7. Navigation & layout global

### 7.1 Dashboard Layout — `src/app/(dashboard)/layout.tsx`

**Wrapper** : `min-h-screen overflow-x-hidden bg-[#f6f7f8]`

**Grid desktop** : `lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start`

**Colonne contenu** : `flex min-h-screen min-w-0 flex-col`

**Zone main** : `min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8`

---

### 7.2 Sidebar Nav — `src/components/sidebar-nav.tsx`

**Wrapper** : `hidden w-full flex-col border-r border-[#e4e8eb] bg-white lg:sticky lg:top-0 lg:flex lg:max-h-[100dvh] lg:w-[17rem] lg:shrink-0 lg:self-start lg:overflow-y-auto`

> La zone logo en haut de la sidebar a un fond sombre (dégradé) via le composant `BrandLogoBlock`. Le reste de la sidebar (`bg-white`) est clair.

**Nav link** : `group flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13px] font-medium transition-colors duration-100`

| État | Fond | Texte | Icône |
|---|---|---|---|
| Actif | `#15323f` | `#f3f7fa` | `#f3f7fa` |
| Inactif | transparent | `#3a4a55` | `#6b7a85` |
| Hover inactif | `#f0f2f4` | `#0e1a21` | `#3a4a55` |

**Icônes** : `h-[1.05rem] w-[1.05rem]`

**Badge count** : `rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums`
- Actif : `bg-white/20 text-white`
- Inactif : `bg-[#e4e8eb] text-[#6b7a85]`

**Labels de section** : `text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]`

**Footer utilisateur** : `border-t border-[#e4e8eb] px-4 py-3`
- Nom : `text-[12px] font-medium text-[#0e1a21]`
- Rôle : `text-[11px] text-[#6b7a85]`

---

### 7.3 Brand Logo Block — `src/components/brand-logo-block.tsx`

Zone logo en haut de la sidebar. Fond sombre avec dégradé.

**Conteneur** : `border-b border-white/10 bg-gradient-to-b from-[#0f1c24] to-[#182b35]`

**Variantes**

| Variante | Logo H×W | Padding |
|---|---|---|
| `sidebar` (défaut) | `h-14 w-48` (sm: `h-16 w-56`) | `px-4 py-6 lg:px-5 lg:py-7` |
| `drawer` | `h-12 w-44` (sm: `h-14 w-52`) | `px-4 py-4` |
| `compact` | `h-9 w-[132px]` (sm: `h-10 w-[148px]`) | — |

**Titre** : `text-[10px] font-semibold uppercase tracking-[0.26em] text-white/72`

**Description** (variant sidebar) : `max-w-[16rem] text-xs leading-relaxed text-white/78`

---

### 7.4 Topbar — `src/components/topbar.tsx`

`sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-[#e4e8eb] bg-white px-4 sm:px-6 lg:px-8`

**Contenu (gauche → droite)** :
1. **Global Search** (`flex-1`)
2. **Bell notifications** : `flex h-8 w-8 items-center justify-center rounded-[6px] text-[#6b7a85]`
3. **Bouton "Nouveau lead"** : `flex items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-semibold text-white`
4. **Avatar** size 30

---

### 7.5 Global Search — `src/components/global-search.tsx`

**Bouton fermé** : `hidden rounded-md border border-[#e4e8eb] bg-[#f4f7fa] px-3 py-1.5 text-xs font-semibold text-[#6b7a85] hover:text-[#0e1a21] lg:inline-flex`

**Dialog ouvert** :
- Backdrop : `fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh]`
- Panel : `w-full max-w-lg rounded-lg border border-[#e4e8eb] bg-white p-4 shadow-xl`
- Input : `w-full rounded-md border border-[#e4e8eb] bg-[#f4f7fa] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#15323f]/25`
- Résultats : `mt-3 max-h-64 space-y-1 overflow-y-auto`
- Item hover : `rounded-md px-2 py-2 text-sm font-medium hover:bg-[#f4f7fa]`

---

### 7.6 Page Leads (liste) — `src/app/(dashboard)/leads/page.tsx`

**Titre** : `text-[19px] font-semibold text-[#0e1a21]`

**Toggle Liste / Kanban** :
- Wrapper : `flex rounded-[6px] border border-[#e4e8eb] bg-white`
- Bouton actif : `bg-[#15323f] text-white`
- Bouton inactif : `text-[#6b7a85] hover:bg-[#f6f7f8]`
- Style commun : `flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors`
- Premier bouton : `rounded-l-[5px]` / Dernier : `rounded-r-[5px]`

**Bouton "+ Nouveau lead"** : aligné sur le bouton topbar — `rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-semibold text-white`

**Skeleton loading** : `h-64 animate-pulse rounded-[8px] bg-[#f4f7fa]`

**Chips de filtre** : File · Tous · Les miens · À assigner · Canal · Tous · Statut · Tous — composant Chip (§5.3)

**Tri** : label `text-[12px] text-[#6b7a85]` + valeur `font-medium text-[#3a4a55]`

---

## 8. États interactifs

### Hover

| Composant | Comportement |
|---|---|
| Bouton CTA steel | `hover:opacity-90` |
| Nav links | `hover:bg-[#f0f2f4]` |
| Cards cliquables | `hover:border-[#15323f]/20` |
| Chips inactifs | `hover:border-[#15323f]/30 hover:bg-[#f6f7f8]` |
| Score pill / AI pill | `hover:bg-white` (depuis `bg-panel-muted`) |
| Quick action buttons | `hover:bg-[#f6f7f8]` |

### Focus (clavier)

Tous les inputs, selects, textareas : `focus:ring-2 focus:ring-[#15323f]/25 focus:outline-none`

### Loading / Pending

- Icône : `<Loader2 className="animate-spin" />` (Lucide)
- Bouton en attente : `disabled:opacity-50` ou `disabled:opacity-60`
- Skeleton : `animate-pulse rounded-[8px] bg-[#f4f7fa]`
- Transitions React : `useTransition()` + état `isPending`

### Disabled

- Boutons : `disabled:opacity-50` ou `disabled:opacity-60`
- Étapes pipeline futures : `opacity-45 cursor-not-allowed`

---

## 9. Responsive

### Breakpoints Tailwind (défauts)

| Breakpoint | Largeur min |
|---|---|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

### Patterns principaux

| Élément | Mobile | Desktop |
|---|---|---|
| Sidebar | Cachée — nav drawer `z-40` | `lg:sticky lg:w-[17rem]` |
| Dashboard grid | `flex flex-col` | `lg:grid-cols-[17rem_1fr]` |
| Cockpit grid | `flex flex-col` | `lg:grid-cols-[300px_1fr_320px]` |
| Dossier champs | `grid-cols-1` | `md:grid-cols-2 xl:grid-cols-4` |
| Padding page | `px-4 py-5` | `lg:px-8 lg:py-8` |

### Mobile nav

`DashboardMobileNav` : drawer latéral `z-40`, contient BrandLogoBlock `variant="drawer"` + sidebar-nav.

---

## 10. Accessibilité

- HTML sémantique : `<nav>`, `<main>`, `<aside>`, `<header>`, `<section>`
- Icônes décoratives : `aria-hidden="true"`
- Icônes fonctionnelles : `aria-label` sur le bouton parent
- Labels de formulaire : `<label htmlFor="...">` associés
- Messages d'erreur : `role="alert"`
- Status live : `role="status"`
- Contrastes : paires texte/fond conformes WCAG AA

---

## 11. Patterns UX

### Pipeline guards

Chaque transition de statut est validée côté serveur (Server Action). Le bouton "Suivant" est désactivé si les prérequis ne sont pas remplis.

**Exemple** : un lead ne peut pas passer à `agency_assignment` sans avoir été qualifié (score IA ou validation manuelle).

### Hiérarchie de lecture dans le cockpit

1. **Grade + Score** (colonne droite, haut) — première lecture
2. **Statut pipeline** (lead rail) — où en est-on
3. **Next Action Card** — que faire maintenant
4. **Détails dossier** — informations complètes

### Mode IA vs Manuel

Le lead a un `workflow_mode` : `ai` ou `manual`.
- Mode IA : qualification et scoring déclenchés automatiquement, AI status pill verte animée
- Mode manuel : l'opérateur saisit les champs manuellement, AI status pill grise

L'UI adapte les CTAs, banners et quick actions en conséquence.

### Feedback utilisateur

- Les Server Actions retournent `{ error?: string }` ou un objet data
- Les erreurs s'affichent inline — pas de toast par défaut
- Les états pending sont signalés par spinner ou opacity réduite

### Densité de l'information

Les tables de leads utilisent des lignes compactes avec `truncate` et attribut `title` natif pour les textes longs. Pas de pagination sous 100 items — scroll continu.

### Couleur = sens métier

Ne jamais utiliser `--revenue` / `--hot` / `--warn` pour un effet décoratif. Ces couleurs sont des signaux opérateurs appris par les utilisateurs.

---

## 12. Pipeline Lead — logique complète

### 12.1 Machine d'état

Le pipeline est une séquence ordonnée de 8 statuts définis dans `src/lib/mock-leads.ts` :

```ts
export const LEAD_PIPELINE: LeadStatus[] = [
  "new", "qualification", "agency_assignment",
  "co_construction", "quote", "negotiation", "won", "lost"
];
```

| # | Statut | Label FR | Accès modification |
|---|---|---|---|
| 1 | `new` | Nouveau | Référent assigné |
| 2 | `qualification` | Qualification & affinage | Référent assigné |
| 3 | `agency_assignment` | Assignation | Référent assigné + brief validé |
| 4 | `co_construction` | Co-construction | Référent assigné |
| 5 | `quote` | Devis | Référent assigné + proposition approuvée |
| 6 | `negotiation` | Négociation | Référent assigné |
| 7 | `won` | Gagné | Admin ou référent |
| 8 | `lost` | Perdu | Admin ou référent |

`lost` est exclu du pipeline visible sauf si le lead est déjà `lost`. Il ne s'affiche pas comme étape suivante normale.

### 12.2 Guards de transition

**`new` → `qualification`** : libre (le référent peut avancer dès assignation).

**`qualification` → `agency_assignment`** : bloqué côté serveur si `isLeadBriefExploitable(lead)` retourne `false`. La checklist doit être complète :
- `destination_main` renseigné
- `trip_dates` renseigné
- `travelers` renseigné
- `budget` renseigné
- `travel_desire_narrative` ≥ 20 caractères
- ET `qualification_validation_status` = `"validated"` ou `"overridden"`

**`co_construction` → `quote`** : une proposition doit avoir le statut `"approved"` et générer un devis (`converted_quote_id` non null).

**Navigation admin vs référent** (dans `LeadCockpitPipeline`) :
- **Admin** : peut cliquer sur toute étape passée ou actuelle (pas les futures).
- **Référent** : peut cliquer sur l'étape active et l'étape précédente uniquement.
- **Future** : `cursor-not-allowed`, tooltip "Complétez l'étape en cours avant de sauter en avant."

### 12.3 Modes workflow

Chaque lead a un `workflow_mode` (`"ai"` | `"manual"`) et un flag `manual_takeover` (boolean).

| Mode | `manual_takeover` | Signification |
|---|---|---|
| `ai` | `false` | Autopilot IA actif — envois WhatsApp automatiques |
| `ai` | `true` | IA suspendue manuellement — opérateur en contrôle |
| `manual` | any | Mode manuel dès le départ |

Le toggle **Suspendre / Reprendre** dans le strip cockpit appelle `toggleAiAutopilot()` qui inverse `manual_takeover`.

### 12.4 Statuts de qualification IA

`qualification_validation_status` : `"pending"` | `"validated"` | `"overridden"` | `"rejected"`

| Valeur | Label UI | Couleur badge |
|---|---|---|
| `pending` | En attente de validation | `#c47c20` (amber) |
| `validated` | Qualifiée | `#2d7a5f` (vert) |
| `overridden` | Modifiée manuellement | `#182b35` (steel) |
| `rejected` | Rejetée | `#a83232` (rouge) |

Style badge inline : `background: ${hex}18, border: 1px solid ${hex}30, border-radius: 4px, padding: 2px 8px, font-size: 11px, font-weight: 600, text-transform: uppercase, letter-spacing: 0.04em`

### 12.5 Statuts co-construction proposal

`CoConstructionProposalRow.status` :

| Statut | Label FR |
|---|---|
| `awaiting_agency` | En attente agence |
| `submitted` | Reçue — modifiable |
| `approved` | Validée pour devis |

### 12.6 Statuts devis (QuoteWorkflowStatus)

**Suivi actif** (`TRACKING`) : `draft`, `sent`, `awaiting_response`, `renegotiation`

**Issues terminales** (`OUTCOMES`) : `won`, `lost`, `suspended`

| Statut terminal | Fond | Texte | Bordure |
|---|---|---|---|
| `won` | `emerald-50` | `emerald-900` | `emerald-700` |
| `lost` | `red-50` | `red-900` | `red-300` |
| `suspended` | `amber-50` | `amber-950` | `amber-600` |

### 12.7 Canaux d'entrée (intake_channel)

| Valeur DB | Label UI |
|---|---|
| `web_form` | Formulaire |
| `whatsapp` | WhatsApp |
| `manual` | Manuel |

### 12.8 Priorité lead

`priority`: `"normal"` | `"high"`

Lead haute priorité (`"high"`) → barre rouge verticale `w-[3px] bg-[#c1411f]` en bord gauche de la ligne/card (absolue, `absolute inset-y-0 left-0`).

### 12.9 SLA de réponse

Calculé comme `created_at + 30 minutes`. États :
- **Done** : `referent_assigned_at` renseigné → dot steel plein
- **À risque** : délai restant < 2h ET non assigné → dot `#a8710b` + label " — À risque"
- **Dépassé** : deadline passée ET non assigné → dot `#c1411f` + label " — Dépassé"

### 12.10 Score commercial & grade

`ai_score` (0–100) → grade + couleur :

| Score | Grade | Couleur hex |
|---|---|---|
| ≥ 90 | A+ | `#0f6b4b` |
| ≥ 75 | A | `#0f6b4b` |
| ≥ 60 | B+ | `#3a4a55` |
| ≥ 45 | B | `#a8710b` |
| < 45 | C | `#c1411f` |
| null | — | `#9aa7b0` |

Tier textuel (affiché dans LeadScorePill) :
- 0–24 : `cold` / "Froid"
- 25–49 : `tepid` / "Tiède"
- 50–74 : `warm` / "Chaud"
- 75–100 : `hot` / "Très chaud"

### 12.11 DotsRating (notation 5 étoiles)

Composant interne `DotsRating` dans `lead-cockpit-shell.tsx` :
- 5 points `h-2 w-2 rounded-full`
- Rempli : `bg-[#15323f]`
- Vide : `bg-[#e4e8eb]`

### 12.12 Transcript IA — bulles de conversation

Dans `LeadAiOpsPanel`, le transcript `conversation_transcript` (JSON array) est affiché en bulles :

| `from` | Fond | Texte | Alignement |
|---|---|---|---|
| `traveler` | `bg-white shadow-sm` | `text-foreground` | `ml-4` (droite) |
| `operator` | `bg-amber-50` | `text-amber-950` | `mr-4` (gauche) |
| `ai` | `bg-[#182b35]` | `text-[#f3f7fa]` | `mr-4` (gauche) |

Label expéditeur : `text-[10px] font-semibold uppercase tracking-wide opacity-80`
- `traveler` → "Voyageur"
- `operator` → "Opérateur"
- `ai` → "Direction l'Algérie"

Conteneur scroll : `max-h-80 space-y-2 overflow-y-auto scroll-mt-28 rounded-md border border-border bg-panel-muted/40 p-3`

---

## 13. Composants pipeline — détail exhaustif

### 13.1 LeadCockpitPipeline — `src/components/leads/lead-cockpit-pipeline.tsx`

Barre de navigation horizontale sticky, affichée au-dessus du workspace. Permet de changer l'étape du lead en cliquant.

```ts
props: { leadId: string; status: LeadStatus; isAdmin?: boolean }
```

**Conteneur** : `border-b border-border bg-panel`
**Scroll horizontal** : `overflow-x-auto px-1 py-2 [-ms-overflow-style:none] [scrollbar-width:thin]`
**Liste** : `flex min-w-max items-center gap-1.5` — `<ol>`

**Séparateur entre étapes** : `<ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/60" />`

**Bouton d'étape** : `group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm`

| État | Classes |
|---|---|
| Actif | `border-steel bg-steel text-steel-ink shadow-sm` |
| Terminé | `border-border bg-panel-muted text-foreground hover:bg-panel` |
| Futur | `cursor-not-allowed border-border/70 bg-transparent text-foreground/45` |

**Dot interne** : `flex size-2.5 shrink-0 rounded-full border`

| État | Dot |
|---|---|
| Terminé | `border-emerald-600 bg-[#e8f4ef]` + `✓` en `text-emerald-800` |
| Actif | `border-steel-ink/70 bg-steel-ink` |
| Futur | `border-border bg-transparent` |

**Erreur** : `px-2 pb-2 text-xs font-medium text-red-600` avec `role="alert"`

---

### 13.2 LeadCockpitStrip — `src/components/leads/lead-cockpit-strip.tsx`

Bande sticky sous la barre pipeline. Affiche la référence, le nom, les pills de score/IA et le toggle Suspendre/Reprendre.

```ts
props: { lead: SupabaseLeadRow; onOpenScoreModal: () => void; onOpenDetailsDrawer: () => void }
```

**Conteneur** : `border-b border-border bg-panel`
**Ligne interne** : `flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2 sm:gap-x-4 sm:px-2`

**Référence lead** : `inline-flex items-center rounded-md border border-border bg-panel-muted px-2 py-1 font-mono text-xs font-semibold text-steel sm:text-sm`

**Nom voyageur** : `min-w-0 truncate text-sm font-semibold text-foreground sm:text-[15px]`

**Dividers** : `hidden h-6 w-px bg-border sm:block` (cachés sur mobile)

**Bouton Suspendre / Reprendre** :
`inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-muted px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-panel disabled:opacity-50`
- Icône `<Pause />` (suspendre) ou `<Play />` (reprendre), `size-3.5`

**Lien retour** : `shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-panel-muted hover:text-foreground` — texte "← Tous les leads"

---

### 13.3 LeadSupabaseStageWorkspace — `src/components/leads/lead-supabase-stage-workspace.tsx`

Orchestrateur principal du workspace lead. Rend le contenu de l'étape active, les formulaires d'assignation, et les sections contextuelles.

```ts
props: {
  lead: SupabaseLeadRow;
  referents: ReferentDisplayRow[];
  referentLabel: string | null;
  agencies: { id: string; label: string }[];
  retainedAgencyLabel: string | null;
  coProposals: CoConstructionProposalRow[];
  leadQuotes: LeadQuoteListItem[];
}
```

**Section active** : `relative z-[1] scroll-mt-24 rounded-xl border-2 border-steel/20 bg-panel p-4 shadow-sm ring-1 ring-steel/10 sm:p-6`

> La section active a une double bordure `border-steel/20` + ring `ring-steel/10` pour la faire ressortir visuellement.

**Badge "Étape active · N / Total"** : `inline-flex items-center gap-2 rounded-full border border-border bg-panel-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-steel`
- Dot : `size-1.5 shrink-0 rounded-full bg-steel`

**Statut en clair** : `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` (mt-2)

**Titre de l'étape** : `font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl` (mt-2)

**Description de l'étape** : `text-sm leading-relaxed text-foreground/85` (mt-2)

**Textes d'introduction par étape** :

| Étape | Titre | Corps (résumé) |
|---|---|---|
| `new` | Nouveau — prise en main | Allouez un opérateur travel desk, puis avancez le pipeline |
| `qualification` | Qualification & affinage du besoin | Enrichissez la fiche, validez la qualification pour débloquer Assignation |
| `agency_assignment` | Assignation — agence partenaire | Choisissez l'agence partenaire (réseau DA) |
| `co_construction` | Co-construction — propositions de circuit | Comparez, affinez, validez avant génération du devis |
| `quote` | Devis | Consolidation et préparation du devis voyageur |
| `negotiation` | Négociation | Ajustements avec le voyageur après envoi de l'offre |
| `won` | Dossier gagné | Projet validé — suite hors périmètre |
| `lost` | Dossier clos | Lead archivé |

**Sections internes** : `space-y-8` avec titres `text-xs font-semibold uppercase tracking-wider text-muted-foreground`

**Checklist qualification** (si `status === "qualification"`) : `rounded-lg border border-border bg-panel-muted/35 p-4`
- Items OK : `border-emerald-200/90 bg-emerald-50/80 text-emerald-950`
- Items NOK : `border-border bg-panel text-foreground/80`
- Style commun : `flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium`
- Grid : `grid gap-2 sm:grid-cols-2`

**Historique propositions circuit** (lecture seule) : `rounded-lg border border-dashed border-border/90 bg-panel-muted/20 p-4 opacity-95`

---

### 13.4 LeadQualificationWorkspace — `src/components/leads/lead-qualification-workspace.tsx`

Formulaire de qualification IA + manuel. Section centrale à l'étape `qualification`.

```ts
props: { lead: SupabaseLeadRow }
```

**Conteneur** : `rounded-md border bg-panel p-4 sm:p-6` avec `borderColor: "#182b35"` (steel foncé)

**Header** : `mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4`
- Titre : `font-display text-lg font-semibold text-foreground`
- Sous-titre mode : `mt-0.5 text-xs text-muted-foreground`
  - IA : "Mode IA — lancez l'agent pour pré-remplir, puis validez."
  - Manuel : "Mode manuel — remplissez directement les champs ci-dessous."
- Confiance IA : `text-[11px] text-muted-foreground` — "Confiance IA : XX %"

**Alertes inline** :
- Erreur : `flex items-start gap-2 rounded-md border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-sm text-red-900` + icône `<AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />`
- Succès : `flex items-start gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900` + icône `<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />`

**Grille de champs** : `grid grid-cols-1 gap-6 lg:grid-cols-2`

**FieldRow (champ standard)** :
- Label : `text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground`
- Input/Textarea : `rounded-md border border-border bg-panel-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#182b35] focus:outline-none focus:ring-2 focus:ring-[#182b35]/20`

**Champs structurés** (colonne gauche) :
- Destination principale
- Période & durée
- Composition du groupe
- Budget indicatif
- Style de voyage
- Notes internes opérateur (multiline)

**Zone narrative** (colonne droite) : `flex flex-1 rounded-md border border-dashed bg-panel-muted/40` avec `borderColor: "#182b35"`, `minHeight: 220`
- Textarea libre, pas de resize, `min-h-[200px]`
- Placeholder : "Ce voyageur porte depuis longtemps le rêve du désert vrai…"

**Actions** : `mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5`

| Bouton | Condition | Style |
|---|---|---|
| Lancer l'agent IA | `!isManual && !isValidated` | `bg-[#182b35] border-[#182b35] text-[#f3f7fa]` + icône `<Sparkles />` |
| Sauvegarder | `!isValidated` | `border-border bg-panel text-foreground hover:bg-panel-muted` + icône `<Save />` |
| Valider la qualification | `!isValidated` | Si `canValidate` : `bg-[#2d7a5f] border-[#2d7a5f] text-white` + icône `<UserCheck /><ChevronRight />`. Sinon : `border-border text-muted-foreground` |
| État validé | `isValidated` | `border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-900` + `<CheckCircle2 />` |

**Condition `canValidate`** : destination + dates + groupe + budget renseignés ET narrative ≥ 20 caractères.

**États loading** : spinner `<Loader2 className="size-4 animate-spin" />` remplace l'icône du bouton actif. Textes : "Agent en cours…", "Sauvegarde…", "Validation…".

---

### 13.5 LeadAiOpsPanel — `src/components/leads/lead-ai-ops-panel.tsx`

Panel IA — transcript conversation, toggle autopilot, shortlist agences.

```ts
props: { lead: SupabaseLeadRow; hideAutopilotToggle?: boolean }
```

**Conteneur** : `rounded-md border border-border bg-panel p-4 sm:p-6`

**Titre** : `text-xs font-semibold uppercase tracking-wider text-muted-foreground` — "Conversation voyageur & IA"

**Toggle autopilot** (si `!hideAutopilotToggle`) :
`rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-semibold hover:bg-panel`
- Texte : "Reprise manuelle (stop IA)" ou "Reprendre le fil IA"

**Section validation brief** (si `qualification_validation_status === "pending"`) :
- Titre : `text-sm font-semibold text-foreground`
- Bouton **Valider** : `rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:opacity-95`
- Bouton **Marquer ajustée** : `rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted`
- Bouton **Rejeter** : `rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 hover:opacity-95`

**Section shortlist** (si `validated` ou `overridden`) :
- Bouton **Générer shortlist IA** : `rounded-md bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:opacity-95`
- Bouton **Comparer propositions** : `rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-panel-muted`

**Erreur** : `text-sm text-red-600` avec `role="status"`

**Transcript** : voir §12.12.

---

### 13.6 LeadWorkflowPanel — `src/components/leads/lead-workflow-panel.tsx`

Panel de lancement/gestion du workflow voyageur (email + IA ou manuel).

```ts
props: {
  leadId: string; currentUserId: string | null; referentId: string | null;
  status: LeadStatus; workflowLaunchedAt: string | null;
  workflowMode: "ai" | "manual" | null; workflowRunRef: string | null;
  manualTakeover: boolean; workflowEmailBanner: string | null;
}
```

**Visible si** : utilisateur = référent ET (`status === "new"` ou `"qualification"`) ET pas encore lancé — OU workflow déjà actif.

**État : workflow actif** → ContextBanner `variant="info"` avec `icon={CalendarClock}` :
- Titre : "Workflow voyageur"
- Contenu : réf. `font-mono font-semibold` + date + mode (IA / Manuel)

**Bouton Supprimer session** (référent uniquement) :
`rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100`
— précédé d'un `window.confirm()`.

**Lien "Gérer manuellement"** : `rounded-md border border-border bg-panel px-4 py-2 text-sm font-semibold text-foreground hover:bg-panel-muted`

**État : lancement disponible** :
- Conteneur : `rounded-md border border-border bg-panel p-4 sm:p-5`
- Titre : `text-sm font-semibold uppercase tracking-wide text-muted-foreground`
- Bouton **Lancer le workflow IA** : `rounded-md bg-[#182b35] px-4 py-2.5 text-sm font-semibold text-[#f3f7fa] hover:opacity-95`
- Bouton **Gérer manuellement** : lien `rounded-md border border-border bg-panel px-4 py-2.5 text-sm font-semibold`
- Si `workflowEmailBanner` : ContextBanner `variant="warning"` + icône `<MailWarning />`

---

### 13.7 ContextBanner — `src/components/leads/context-banner.tsx`

Alerte contextuelle non-dismissable, utilisée dans tous les panels.

```ts
props: { variant: ContextBannerVariant; title: string; children: ReactNode; icon?: LucideIcon; className?: string }
type ContextBannerVariant = "info" | "ia" | "operator" | "agency" | "warning"
```

**Structure** : `rounded-md border px-3 py-2.5 text-sm leading-snug` avec `role="note"`

| Variante | Fond | Texte | Bordure |
|---|---|---|---|
| `info` | `sky-50/90` | `sky-950` | `sky-200/90` |
| `ia` | `sky-50/90` | `sky-950` | `sky-200/90` |
| `operator` | `amber-50/90` | `amber-950` | `amber-200/90` |
| `warning` | `amber-50/90` | `amber-950` | `amber-200/90` |
| `agency` | `panel-muted` | `foreground` | `border` |

**Icône** (si fournie) : `mt-0.5 size-4 shrink-0 opacity-90`

**Titre** : `block text-[10px] font-bold uppercase tracking-[0.08em] opacity-90`

**Corps** : `mt-1 block font-medium`

**Lien interne** (ex. vers transcript) : `font-semibold text-sky-900 underline decoration-sky-700/40 underline-offset-2 hover:decoration-sky-900`

---

### 13.8 AssignReferentForm — `src/components/leads/assign-referent-form.tsx`

Formulaire d'assignation de l'opérateur travel desk au lead.

```ts
props: {
  leadId: string; currentReferentId: string | null;
  referents: ReferentDisplayRow[]; variant?: "travel_desk" | "referent"
}
```

**Structure** : `space-y-3` dans un `<form>`

**Label** : `text-xs text-muted-foreground` — span `font-semibold uppercase tracking-wider`

**Select** : `mt-2 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25`
- Option vide : "— Non assigné —"

**Bouton submit** : `w-full rounded-md bg-steel px-3 py-2 text-sm font-semibold text-steel-ink hover:opacity-95 disabled:opacity-50`
- Textes : "Allouer l'opérateur" (travel_desk) / "Enregistrer l'opérateur" (referent) / "Enregistrement…" (pending)

**Feedback** :
- Succès : `text-sm text-emerald-700`
- Erreur : `text-sm text-red-600`

---

### 13.9 AssignPartnerAgencyForm — `src/components/leads/assign-partner-agency-form.tsx`

Formulaire d'assignation de l'agence partenaire (étape `agency_assignment`).

```ts
props: { leadId: string; currentAgencyId: string | null; agencies: { id: string; label: string }[] }
```

Structure identique à `AssignReferentForm`. Différences :
- Label : "Agence partenaire (traitement du lead)"
- Bouton : "Assigner l'agence partenaire"
- Option vide : "— Aucune agence assignée —"
- Message succès : "Agence partenaire enregistrée."

---

### 13.10 CoConstructionPanel — `src/components/leads/co-construction-panel.tsx`

Gestion des propositions de circuit. Présent à l'étape `co_construction` (éditable) et en historique sur les autres étapes (lecture seule).

```ts
props: { leadId: string; proposals: CoConstructionProposalRow[]; editable: boolean }
```

**En-tête** : `flex flex-wrap items-center justify-between gap-3`
- Description : `text-sm text-foreground/90`
- Bouton "+ Nouvelle proposition" (si `editable`) : `rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#213e4b]`

**Erreur** : `rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900`

**État vide** : `text-sm text-muted-foreground`

**Carte proposition** : `rounded-md border border-border bg-panel-muted/30 p-4 sm:p-5`

Header carte :
- Titre : `font-semibold text-foreground`
- Version + date : `text-xs text-muted-foreground` — "Version X — JJ/MM"
- Scores IA : `text-xs text-foreground/90` — "Match IA : XX% · recommandée"
- Rationale IA : `text-xs italic text-muted-foreground`

**Badge statut** : `rounded-none border border-border bg-panel px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/90`

**Bouton Supprimer** : `inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50/90 px-2 py-1 text-[11px] font-semibold text-red-900 hover:bg-red-100` + icône `<Trash2 className="size-3.5" />`
— déclenche `window.confirm()`.

**Sous-états selon `proposal.status`** :

**`awaiting_agency` + editable** (AwaitingAgencyForm) :
- Textarea "Circuit proposé *" : `w-full resize-y rounded-md border border-border bg-panel px-3 py-2 text-sm focus:ring-2 focus:ring-steel/25`, `rows={8}`
- Bouton : `rounded-md border border-border bg-panel px-3 py-2 text-sm font-semibold hover:bg-panel-muted`

**`submitted` + editable** (SubmittedForms) :
- Textarea "Circuit (modifiable)" : `rows={10}`, même style
- Bouton "Enregistrer" : `border-border bg-panel hover:bg-panel-muted`
- Bouton **"Valider pour devis"** : `rounded-md border border-[#182b35] bg-[#182b35] px-3 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#213e4b]`

**`submitted` lecture seule** (OutlineReadOnly) : `pre` avec `max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-panel p-3 text-sm`

**`approved`** (ApprovedBlock) :
- Si devis généré : `text-sm font-medium text-foreground` + réf. `font-mono text-xs`
- Bouton **"Générer le devis"** : même style steel foncé
- Si devis généré → pipeline passe à `quote`

---

### 13.11 LeadQuotesPanel — `src/components/leads/lead-quotes-panel.tsx`

Liste et gestion des devis. Visible aux étapes `quote` et `negotiation`.

```ts
props: { leadId: string; quotes: LeadQuoteListItem[] }
```

**État vide** : `text-sm text-muted-foreground`

**Carte devis** : `rounded-md border border-border bg-panel-muted/30 p-4 sm:p-5`

Header :
- ID : `font-mono text-[11px] text-muted-foreground` (8 premiers chars + "…")
- Date : `text-xs text-muted-foreground`

Boutons header :
- **Télécharger PDF** : `inline-flex items-center gap-2 rounded-md border border-[#182b35] bg-panel px-3 py-2 text-sm font-semibold text-[#182b35] hover:bg-panel-muted` + `<Download className="size-4" />`
- **Envoyer PDF (WhatsApp)** (si non terminal) : `inline-flex items-center gap-2 rounded-md border border-emerald-800 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-100` + `<MessageCircle className="size-4" />`

Suivi : `text-muted-foreground` + statut `font-semibold text-foreground` + kind `text-xs text-muted-foreground`

**Bloc contrôle** (si non terminal) : `rounded-md border border-border bg-panel p-3`
- Select statut : `w-full max-w-md rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-steel/25`
- Titre issues : `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- Boutons issue : voir §12.6

**Lignes devis** : `space-y-1.5` — label `font-medium text-foreground` + detail `text-muted-foreground`

**Résumé texte brut** : `<details>` avec `<pre class="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-panel p-3 text-xs">`

**État terminal** : `text-xs text-muted-foreground` — "Devis clos — le statut ne peut plus être modifié."

---

### 13.12 LeadCommercialCrmForm — `src/components/leads/lead-commercial-crm-form.tsx`

Grille CRM express (étape `qualification`). Deux selects + bouton. Cible ~1 min opérateur.

```ts
props: { lead: SupabaseLeadRow }
```

**Grid** : `grid gap-3 sm:grid-cols-2`

**Select** : `mt-1.5 w-full rounded-md border border-border bg-panel px-2 py-1.5 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-steel/25`

**Champs** :
- `crm_conversion_band` — "Probabilité de conversion" (`CRM_CONVERSION_OPTIONS`)
- `crm_follow_up_strategy` — "Stratégie de relance" (`CRM_FOLLOW_UP_OPTIONS`)

**Bouton** : `rounded-md bg-steel px-3 py-2 text-sm font-semibold text-steel-ink hover:opacity-95`

**Sous-texte** : `text-xs text-muted-foreground` — "Cible ~1 min : conversion + relance."

---

### 13.13 Table Leads (LeadsListServer) — `src/components/leads/leads-list-server.tsx`

Tableau serveur de la liste des leads avec tabs de statut.

**Sous-header** : `text-[13px] text-[#6b7a85]` — "X dossiers · Y k€ de pipeline visible"

**Tabs de statut** : `flex flex-wrap gap-1 border-b border-[#e4e8eb] pb-0`

**TabLink** : `flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors`
- Actif : `border-[#15323f] text-[#0e1a21]`
- Inactif : `border-transparent text-[#6b7a85] hover:text-[#3a4a55]`
- Badge count actif : `rounded-full px-1.5 text-[10px] font-semibold tabular-nums bg-[#15323f] text-white`
- Badge count inactif : `bg-[#f4f7fa] text-[#6b7a85]`

**Table** : `overflow-x-auto rounded-[8px] border border-[#e4e8eb] bg-white`

**En-têtes** : `px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]`
Colonnes : (hot) · Voyageur · Projet · Étape · Budget · Dates · Référent · Canal · Activité · (actions)

**Ligne** : `group relative border-b border-[#e4e8eb] last:border-0 transition-colors hover:bg-[#f6f7f8]`

**Barre priorité haute** : `h-full w-[3px] rounded-r bg-[#c1411f]` dans la 1ère `<td>` (`min-height: 40px`)

**Voyageur** : Avatar(30, gold) + nom `text-[13px] font-medium text-[#0e1a21]` + email `text-[11px] text-[#6b7a85]`

**Projet** : `max-w-[200px]` — résumé `line-clamp-2 text-[12px] text-[#3a4a55]` + composition `text-[11px] text-[#9aa7b0]`

**Étape** : `flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#e4e8eb] px-2 py-1 text-[11px] font-medium text-[#3a4a55]` + StageDot

**Budget** : `font-mono text-[12px] font-medium text-[#0e1a21]` (aligné à droite)

**Référent** : Avatar(22) + prénom `text-[12px] text-[#3a4a55]` — ou Pill `variant="warn"` "Non assigné"

**Activité** : `text-[12px] text-[#9aa7b0]` (relative time)

**Actions hover** : `hidden items-center gap-1 group-hover:flex` — bouton "Ouvrir" `rounded-[4px] border border-[#e4e8eb] bg-white px-2 py-1 text-[11px] font-medium`

**État vide** : `flex flex-col items-center justify-center gap-2 py-20 text-[#9aa7b0]` + lien "Réinitialiser les filtres" en `text-[#1e5a8a] underline`

---

### 13.14 InboxItem — `src/components/leads/inbox-item.tsx`

Item de la liste inbox (vue liste compacte, alternative au tableau).

```ts
props: { lead: SupabaseLeadRow; selected: boolean; onClick: () => void }
```

**Bouton** : `group relative flex w-full flex-col gap-2 border-b border-[#e4e8eb] px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15323f]/40`
- Sélectionné : `bg-[#15323f]/5`
- Non sélectionné : `bg-white hover:bg-[#f6f7f8]`

**Barre haute priorité** : `absolute inset-y-0 left-0 w-[3px] rounded-l bg-[#c1411f]`

**Ligne 1** : `flex items-center gap-2`
- StageDot (status)
- Nom : `flex-1 truncate text-[13px] font-semibold text-[#0e1a21]`
- Date relative : `shrink-0 text-[11px] text-[#9aa7b0]`
- Dot validation pending : `h-2 w-2 shrink-0 rounded-full bg-[#1e5a8a]`

**Ligne 2** (résumé) : `line-clamp-2 text-[12px] leading-snug text-[#6b7a85]`

**Ligne 3** (meta chips) : `flex flex-wrap gap-1.5` — Pills `variant="neutral"` pour canal, budget, dates. Pill `variant="warn"` si `!referent_id`.

---

### 13.15 LeadIntakeModal — `src/components/leads/lead-intake-modal.tsx`

Modale de création manuelle d'un lead (bouton "+ Nouveau lead").

```ts
props: { open: boolean; onClose: () => void; onCreated: () => void }
```

**Backdrop** : `fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center` + overlay `bg-[#0b1419]/50`

**Panel** : `relative z-10 flex max-h-[min(92vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-border bg-panel shadow-lg`

**Header** : `flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6`
- Titre : `font-display text-lg font-semibold text-foreground` — "Nouveau lead (formulaire site)"
- Bouton fermer : `rounded p-1 text-muted-foreground hover:bg-panel-muted hover:text-foreground` + `<X className="size-5" />`

**Corps scroll** : `min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6`

**Sections et champs** :

| Section | Champs |
|---|---|
| Contact voyageur | Prénom, Nom, Email*, Téléphone |
| Projet | Étape de planification, Type de groupe, Nombre de voyageurs |
| Dates | Mode (select), Début, Fin, Mois flexible, Durée |
| Préférences | Hébergements, Vision du voyage, Préférences de suivi |
| Budget | Devise (select EUR/USD/DZD), Budget idéal/pers., Budget max/pers. |
| Notes | Notes détaillées, URL page origine, ID soumission, Priorité (select) |

**Titres de section** : `text-xs font-semibold uppercase tracking-wider text-muted-foreground`

**Field (input)** : `mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25`
- Label : `block text-xs font-semibold uppercase tracking-wide text-muted-foreground`

**TextArea** : même style + `resize-y`

**Select** : `mt-1 w-full rounded-md border border-border bg-panel-muted/40 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-steel/25`

**Footer** : `flex shrink-0 justify-end gap-2 border-t border-border bg-panel px-5 py-4 sm:px-6`
- Bouton Annuler : `rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-panel-muted`
- Bouton Créer : `rounded-md border border-transparent bg-steel px-4 py-2 text-sm font-semibold text-[#f3f7fa] hover:bg-[#0f1c24] disabled:opacity-50`
- Textes : "Créer le lead" / "Création…"

**Erreur** : `text-sm text-red-600` avec `role="alert"` — inline dans le corps du form.

---

### 13.16 SlaChronology (interne à LeadCockpitShell)

Composant interne dans `lead-cockpit-shell.tsx`. Timeline verticale 4 étapes.

**Étapes** :
1. Créé (`created_at`)
2. Référent assigné (`referent_assigned_at`)
3. Qualif. terminée (`qualification_validated_at`)
4. SLA 1ʳᵉ réponse (30 min après `created_at`)

**Dot** : `mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2`

| État | Couleur |
|---|---|
| Terminé | `border-[#15323f] bg-[#15323f]` |
| SLA dépassé | `border-[#c1411f] bg-[#c1411f]` |
| SLA à risque | `border-[#a8710b] bg-[#a8710b]` |
| En attente | `border-[#e4e8eb] bg-white` |

**Connecteur vertical** : `mt-0.5 h-4 w-[2px] shrink-0 bg-[#e4e8eb]`

**Label** : `text-[12px] font-medium`
- Dépassé : `text-[#c1411f]` + " — Dépassé"
- À risque : `text-[#a8710b]` + " — À risque"
- Fait : `text-[#0e1a21]`
- Futur : `text-[#9aa7b0]`

**Date** : `text-[11px] text-[#6b7a85]`

---

*Mis à jour le 2026-04-21 — document exhaustif extrait du code source. À synchroniser à chaque ajout de composant pipeline ou modification de logique métier.*
