# Design System — Direction l'Algérie Travel Lead Desk

Référence complète pour tout agent IA (Claude Design ou autre) chargé de produire ou modifier de l'UI dans ce projet. Chaque valeur est extraite directement du code source actuel — aucune interpolation.

---

## Table des matières

1. [Principes](#1-principes)
2. [Tokens de couleur](#2-tokens-de-couleur)
3. [Typographie](#3-typographie)
4. [Espacement, radii & z-index](#4-espacement-radii--z-index)
5. [Composants UI atomiques](#5-composants-ui-atomiques)
6. [Composants domaine Lead](#6-composants-domaine-lead)
7. [Navigation & layout global](#7-navigation--layout-global)
8. [États interactifs](#8-états-interactifs)
9. [Responsive](#9-responsive)
10. [Accessibilité](#10-accessibilité)
11. [Patterns UX](#11-patterns-ux)

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

*Généré le 2026-04-21 — à mettre à jour à chaque ajout de composant ou modification des tokens.*
