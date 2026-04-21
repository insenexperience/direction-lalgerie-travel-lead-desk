# Design System — Direction l'Algérie Travel Lead Desk

Ce document est la référence complète du design system pour tout agent IA (Claude Design ou autre) chargé de produire ou modifier de l'UI dans ce projet. Il couvre les tokens, la typographie, les composants, les patterns d'UX et le comportement responsive.

---

## Table des matières

1. [Principes](#1-principes)
2. [Tokens de couleur](#2-tokens-de-couleur)
3. [Typographie](#3-typographie)
4. [Espacement & layout](#4-espacement--layout)
5. [Composants UI de base](#5-composants-ui-de-base)
6. [Composants domaine Lead](#6-composants-domaine-lead)
7. [Composants de navigation](#7-composants-de-navigation)
8. [Layouts](#8-layouts)
9. [États interactifs](#9-états-interactifs)
10. [Responsive](#10-responsive)
11. [Accessibilité](#11-accessibilité)
12. [Patterns UX](#12-patterns-ux)

---

## 1. Principes

| Principe | Description |
|---|---|
| **Premium & sobre** | Pas d'ornements superflus. La couleur porte le sens (statut, urgence, succès). |
| **Information-dense** | Les opérateurs traitent de nombreux leads ; chaque pixel doit servir. Pas d'espaces vides gratuits. |
| **Hiérarchie sémantique** | Couleur + taille + poids typographique communiquent ensemble le niveau d'importance. |
| **Mobile-first, desktop-optimisé** | Les vues critiques (cockpit lead) sont conçues pour lg:, mais restent utilisables sur mobile. |
| **Tokens only** | Toutes les couleurs, espacements et radii sont définis via des variables CSS. Ne jamais coder une valeur hexadécimale en dur dans un composant sans passer par un token. |

---

## 2. Tokens de couleur

Définis dans `src/styles/globals.css` via `@theme`. À utiliser via les classes Tailwind générées ou les variables CSS.

### Palette principale

| Token CSS | Valeur | Rôle |
|---|---|---|
| `--steel` | `#15323f` | Accent principal — nav active, boutons CTA, rails pipeline |
| `--steel-ink` | `#f3f7fa` | Texte sur fond steel |
| `--bg` | `#f6f7f8` | Fond de page global |
| `--surface` | `#ffffff` | Fond de carte/composant |
| `--panel` | `#ffffff` | Alias surface (panels) |
| `--panel-muted` | `#f4f7fa` | Fond de section secondaire, input muted |
| `--line` | `#e4e8eb` | Bordures par défaut |

### Échelle ink (texte)

| Token CSS | Valeur | Usage |
|---|---|---|
| `--ink` | `#0e1a21` | Titres, texte principal |
| `--ink-2` | `#3a4a55` | Texte secondaire, valeurs de champs |
| `--ink-3` | `#6b7a85` | Texte tertiaire, placeholders |
| `--ink-4` | `#9aa7b0` | Labels uppercase, metadata très secondaire |

### Couleurs sémantiques

| Token CSS | Valeur | Sémantique |
|---|---|---|
| `--revenue` | `#0f6b4b` | Succès, won, positif |
| `--hot` | `#c1411f` | Urgence, lost, négatif |
| `--warn` | `#a8710b` | Avertissement, negotiation |
| `--info` | `#1e5a8a` | Information, qualification |
| `--gold` | `#b68d3d` | Highlight, agency_assignment, avatar gold |

### Palette de statut lead complet

| Statut | Couleur point | Usage |
|---|---|---|
| `new` | `#6b7a85` (ink-3) | Gris neutre |
| `qualification` | `#1e5a8a` (info) | Bleu |
| `agency_assignment` | `#b68d3d` (gold) | Or |
| `co_construction` | `#a8710b` (warn) | Orange |
| `quote` | `#15323f` (steel) | Steel |
| `negotiation` | `#a8710b` (warn) | Orange |
| `won` | `#0f6b4b` (revenue) | Vert |
| `lost` | `#c1411f` (hot) | Rouge |

---

## 3. Typographie

### Familles de polices

| Variable | Police | Fallbacks | Usage |
|---|---|---|---|
| `--font-inter` | Inter | system-ui, Segoe UI | UI générale (sans-serif) |
| `--font-jetbrains` | JetBrains Mono | Fira Code, monospace | IDs, références, valeurs numériques tabulaires |

> JetBrains Mono utilise `font-variant-numeric: tabular-nums` pour aligner les chiffres dans les tableaux et KPIs.

### Échelle typographique

| Taille | Tailwind | Usage typique |
|---|---|---|
| 9px | `text-[9px]` | Initiales avatar 22px |
| 10px | `text-[10px]` | Labels section uppercase (`tracking-widest`) |
| 11px | `text-[11px]` | Pills, badges, métadonnées compactes |
| 12px | `text-[12px]` | Valeurs de champs, boutons CTA |
| 13px | `text-[13px]` | Corps de texte compact |
| 14px | `text-sm` | Corps standard (base du body) |
| 15px | `text-[15px]` | Corps large (desktop) |
| 18px | `text-[18px]` | Score numérique (font-mono) |
| 28px | `text-[28px]` | Valeur KPI |
| 34px | `text-[34px]` | Grade commercial (A+, B…) |

### Conventions typographiques

- **Labels de section** : `text-[10px] uppercase tracking-widest text-ink-4` — jamais plus grand que 11px
- **Valeurs de champ** : `text-[12px] font-medium text-ink-2`
- **Titres de carte** : `text-sm font-semibold text-ink`
- **Références/IDs** : `font-mono text-[11px]`
- **Boutons CTA** : `text-[12px] font-semibold`

---

## 4. Espacement & layout

### Radii

| Valeur | Usage |
|---|---|
| `rounded-none` | Séparateurs, dividers |
| `rounded` (4px) | Pills, badges, chips |
| `rounded-md` (6px) | Banners, textareas, petits composants |
| `rounded-[8px]` | Cartes, panels principaux |
| `rounded-lg` | Formulaire login |
| `rounded-full` | Avatars, dots, score bars |

### Échelle de gap

`gap-1`, `gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-5`, `gap-6` — progression régulière. Utiliser `gap-1.5` pour l'intérieur des pills/badges, `gap-2` pour les sections de champs, `gap-4` entre les cartes.

### Z-index

| Couche | z-index | Composant |
|---|---|---|
| Topbar | 20 | `topbar.tsx` |
| Nav mobile | 40 | `dashboard-mobile-nav.tsx` |
| Modales / overlays | 50 | Sheets, dialogs |

### Padding de page

| Breakpoint | Padding horizontal |
|---|---|
| Mobile | `px-4` |
| sm | `px-5` |
| lg | `px-8` |

---

## 5. Composants UI de base

### 5.1 Pill (`src/components/ui/pill.tsx`)

Badge texte inline avec variante sémantique et point optionnel.

**Props**
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

**Anatomie** : `inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium`

Le `dot` est un `span` de `6×6px rounded-full` coloré selon la variante.

---

### 5.2 Avatar (`src/components/ui/avatar.tsx`)

Cercle avec initiales (prénom[0] + nom[0]).

**Props**
```ts
name: string
size: 22 | 30 | 34 | 44
gold?: boolean
className?: string
```

| Taille | Texte | Usage |
|---|---|---|
| 22px | `text-[9px]` | Compact (nav latérale) |
| 30px | `text-[11px]` | Topbar |
| 34px | `text-[12px]` | Cartes |
| 44px | `text-[15px]` | Profil utilisateur |

**Couleurs** : Défaut → `bg:#e4e8eb text:#3a4a55` / Gold → `bg:#b68d3d text:white`

---

### 5.3 Chip (`src/components/ui/chip.tsx`)

Bouton toggle ou lien filtré, avec badge compteur optionnel.

**Props**
```ts
href?: string
active?: boolean
count?: number
children: ReactNode
onClick?: () => void
```

| État | Fond | Bordure | Texte |
|---|---|---|---|
| Actif | `#15323f` | `#15323f` | `#f3f7fa` |
| Inactif | `white` | `#e4e8eb` | `#3a4a55` |
| Hover inactif | `#f6f7f8` | `#15323f/30` | — |

**Badge compteur** : Actif → `bg:white/20 text:white` / Inactif → `bg:#e4e8eb text:#6b7a85`

---

### 5.4 KPI Card (`src/components/ui/kpi-card.tsx`)

Carte de métrique dashboard avec valeur, delta et lien optionnel.

**Props**
```ts
label: string         // uppercase
value: ReactNode      // chiffre principal
delta?: number        // variation
deltaLabel?: string   // unité de variation
href?: string
mono?: boolean        // valeur en font-mono
```

**Anatomie** : `flex flex-col gap-2 border rounded-[8px] p-5`

- Label : `text-[11px] uppercase tracking-wider text-ink-4`
- Valeur : `text-[28px] font-semibold text-ink`
- Delta positif : icône `TrendingUp`, `text-revenue`
- Delta négatif : icône `TrendingDown`, `text-hot`

---

### 5.5 Stage Dot (`src/components/ui/stage-dot.tsx`)

Point coloré `7×7px rounded-full` indiquant le statut pipeline. Couleurs alignées sur la palette de statut (§2).

---

## 6. Composants domaine Lead

### 6.1 Lead Status Badge (`src/components/lead-status-badge.tsx`)

Badge complet avec icône Lucide + label traduit en français.

| Statut | Fond | Texte | Bordure | Icône |
|---|---|---|---|---|
| `new` | `#f7fafc` | `#1c2b32` | `#d7dee5` | Inbox |
| `qualification` | `#eef2f6` | `#223842` | `#cfd8e0` | ListChecks |
| `agency_assignment` | `#dfe8ef` | `#152a35` | `#b8c6d2` | Building2 |
| `co_construction` | `#d4e0ea` | `#0f1c24` | `#a8bac9` | Users |
| `quote` | `#f0f4f8` | `#1a3040` | `#d7dee5` | FileText |
| `negotiation` | `#eceff2` | `#3d4f5c` | `#dce3e9` | Handshake |
| `won` | `#e5f3ef` | `#1f5c4a` | `#b8dcc8` | CheckCircle2 |
| `lost` | `#eef0f2` | `#5c6570` | `#d4d8dc` | XCircle |

---

### 6.2 Lead Score Pill (`src/components/leads/lead-score-pill.tsx`)

Affiche le score numérique + tier + barre de progression.

| Tier | Fond | Texte | Label |
|---|---|---|---|
| `cold` | `#e5e7eb` | `#78716c` | Froid |
| `tepid` | `#fef3c7` | `#92400e` | Tiède |
| `warm` | `#fdf3e0` | `#8a5c1a` | Chaud |
| `hot` | `#fee2e2` | `#7a1f1f` | Très chaud |

Barre : `h-1.5 min-w-[2.5rem] max-w-[4rem] rounded-full bg:#e4e8eb` avec fill steel proportionnel au score.

---

### 6.3 Lead AI Status Pill (`src/components/leads/lead-ai-status-pill.tsx`)

| État | Couleur dot | Label |
|---|---|---|
| Non démarré | `#a3a3a3` | IA non démarrée |
| Suspendu | `#c47c20` | IA suspendue |
| Actif | `#2d7a5f` (pulse animé) | IA active |

Le dot "active" utilise `animate-pulse` pour signaler l'activité en cours.

---

### 6.4 Lead Rail (`src/components/leads/lead-rail.tsx`)

Indicateur de progression pipeline horizontal. 7 étapes : Nouveau → Qualif. → Assignation → Co-construct. → Devis → Négociation → Gagné.

**Nœud actif** : `border-steel bg-steel` avec point blanc  
**Nœud terminé** : `border-steel bg-white` avec icône check  
**Nœud futur** : `border:#e4e8eb bg-white` avec stage dot  
**Connecteur** : `h-[2px]` — steel si fait, `#e4e8eb` si futur

---

### 6.5 Next Action Card (`src/components/leads/next-action-card.tsx`)

CTA contextuel adapté au statut du lead. Toujours visible dans le cockpit.

**Structure** : badge de priorité + titre + description + bouton CTA  
**Conteneur** : `rounded-[8px] border-#e4e8eb bg-white p-4`  
**CTA** : `bg-#15323f text-white px-3 py-2 text-[12px] font-semibold rounded-[6px]`

Badges de priorité alignés sur les variantes Pill (§5.1).

---

### 6.6 Context Banner (`src/components/leads/context-banner.tsx`)

Alerte contextuelle non dismissable dans les panels.

| Variante | Fond | Texte | Bordure |
|---|---|---|---|
| `info` / `ia` | `sky-50` | `sky-950` | `sky-200` |
| `operator` / `warning` | `amber-50` | `amber-950` | `amber-200` |
| `agency` | `panel-muted` | `foreground` | `border` |

**Anatomie** : `rounded-md border px-3 py-2.5 text-sm flex gap-2`  
Icône optionnelle + `<span class="uppercase font-bold text-[10px]">` pour le titre.

---

### 6.7 Lead Cockpit Shell (`src/components/leads/lead-cockpit-shell.tsx`)

**C'est le composant le plus complexe.** Il définit la mise en page principale du détail lead.

#### Structure globale

```
┌─────────────────────────────────────────────────────┐
│  Header : Titre lead + référence + pills statut      │
├─────────────────────────────────────────────────────┤
│  Lead Rail (pipeline progress)                       │
├─────────────────────────────────────────────────────┤
│  Next Action Card                                    │
├────────────┬────────────────────┬───────────────────┤
│ Left 300px │ Center (1fr)       │ Right 320px       │
│ Voyageur   │ Tabs (children)    │ Scoring           │
│ Référent   │                    │ SLA timeline      │
│ Contact    │                    │ Quick actions     │
└────────────┴────────────────────┴───────────────────┘
```

Le grid lg applique : `grid-cols-[300px_minmax(0,1fr)_320px]`

#### Section scoring (colonne droite)

- Titre : `text-[10px] uppercase tracking-widest text-ink-4`
- Grade : `text-[34px] font-bold`

| Grade | Couleur |
|---|---|
| A+ / A | `#0f6b4b` (revenue) |
| B+ | `#3a4a55` (ink-2) |
| B | `#a8710b` (warn) |
| C | `#c1411f` (hot) |
| null | `#9aa7b0` (ink-4) |

#### Cartes internes

`rounded-[8px] border-#e4e8eb bg-white px-4 py-3`

---

### 6.8 Lead Cockpit Dossier (`src/components/leads/lead-cockpit-dossier.tsx`)

Formulaire de consultation/édition du profil lead.

**Layout** : `md:grid-cols-2 xl:grid-cols-4 gap-4`

**4 sections** :
1. **Voyageur** — Nom, canal d'entrée, dates de contact
2. **Voyage** — Dates, taille du groupe, budget
3. **Qualification** — Score IA, confidence, validation manuelle
4. **Pilotage** — Référent assigné, mode workflow, étape

**Champ de lecture** :
- Label : `text-[10px] uppercase text-ink-4`
- Valeur : `text-[12px] font-medium text-ink-2`

**Toggle édition** : `border-border bg-panel-muted px-3 py-2 text-sm rounded-md`

---

### 6.9 Lead Cockpit Strip (`src/components/leads/lead-cockpit-strip.tsx`)

Header compact sticky au-dessus des tabs, visible pendant le scroll.

**Contenu** : référence (font-mono) + nom voyageur + dividers + score pill + AI status pill + bouton Suspend/Resume

**Référence** : `border-border bg-panel-muted px-2 py-1 font-mono text-[11px] rounded`  
**Divider** : `h-6 w-px bg-border`  
**Bouton Suspend** : `border-border bg-panel-muted px-2.5 py-1.5 text-xs rounded-md`

---

### 6.10 Lead Quotes Panel (`src/components/leads/lead-quotes-panel.tsx`)

Gestion des devis (liste, téléchargement PDF, envoi WhatsApp, résolution).

**Carte devis** :
- Référence : `font-mono text-[11px]`
- Date : `text-[11px] text-ink-3`

**Bouton PDF** : `border-#182b35 bg-panel px-3 py-2 text-[12px] rounded-md`  
**Bouton WhatsApp** : `border-emerald-800 bg-emerald-50 text-emerald-900`

**Boutons résolution** :

| Action | Fond | Texte | Bordure |
|---|---|---|---|
| Won | `emerald-50` | `emerald-900` | `emerald-700` |
| Lost | `red-50` | `red-900` | `red-300` |
| Suspendu | `amber-50` | `amber-950` | `amber-600` |

---

### 6.11 Co-Construction Panel (`src/components/leads/co-construction-panel.tsx`)

Gestion des propositions de circuit en itération avec les agences.

**Carte proposition** : `rounded-md border-border bg-panel-muted/30 p-4 sm:p-5`  
**Version** : `text-[11px] font-medium text-ink-3`  
**Badge statut** : `border-border bg-panel px-2 py-1 text-[11px] rounded`

**Textarea** : `rounded-md border-border bg-panel p-3 focus:ring-2 focus:ring-steel/25`  
**Bouton Approuver** : `bg-#182b35 text-#f3f7fa px-3 py-2 text-sm font-semibold rounded-md`

---

### 6.12 Lead Pipeline Step Nav (`src/components/leads/lead-pipeline-step-nav.tsx`)

Navigation Précédent / Suivant entre les étapes pipeline.

| Bouton | Style |
|---|---|
| Précédent | `border-border/70 bg-panel/80 px-2.5 py-1.5 text-xs rounded-md` |
| Suivant | `border-#182b35 bg-#182b35 text-#f3f7fa px-2.5 py-1.5 text-xs rounded-md` |

Variante `floating` : plus compact, pour headers fixes.

---

## 7. Composants de navigation

### 7.1 Topbar (`src/components/topbar.tsx`)

**Position** : `sticky top-0 z-20`  
**Hauteur** : `h-12`  
**Style** : `flex border-b border-#e4e8eb bg-white px-4 sm:px-6 lg:px-8`

**Contenu** :
- GlobalSearch (`flex-1`)
- Icône Bell (notifications — placeholder)
- Bouton "Nouveau lead" : `bg-#15323f text-white px-3 py-1.5 text-[12px] font-semibold rounded`
- Avatar (size 30)

---

### 7.2 Sidebar Nav (`src/components/sidebar-nav.tsx`)

**Visibilité** : `hidden lg:block` — présent uniquement desktop  
**Dimensions** : `w-[17rem] max-h-[100dvh] overflow-y-auto sticky top-0`

**Sections** :
1. BrandLogoBlock variant="sidebar"
2. Navigation travail : Inbox, Dashboard, Leads
3. Navigation ressources : Agencies, Quotes, Users, Settings
4. Footer utilisateur (avatar + nom + déconnexion)

**NavLink actif** : `bg-#15323f text-#f3f7fa`  
**NavLink inactif** : `text-#3a4a55 hover:bg-#f0f2f4`

**Badge count actif** : `bg-white/20 text-white text-[10px]`  
**Badge count inactif** : `bg-#e4e8eb text-#6b7a85`

---

### 7.3 Brand Logo Block (`src/components/brand-logo-block.tsx`)

**Variantes**

| Variante | Hauteur | Largeur |
|---|---|---|
| `compact` | h-9 (sm:h-10) | w-[132px] (sm:w-[148px]) |
| `drawer` | h-12 (sm:h-14) | w-44 (sm:w-52) |
| `sidebar` | h-14 (sm:h-16) | w-48 (sm:w-56) |

**Conteneur** : `bg-gradient-from-[#0f1c24] to-[#182b35] border-b border-white/10 flex flex-col items-center`  
**Tagline** : `uppercase tracking-[0.26em] text-white/72`

---

## 8. Layouts

### 8.1 Root Layout (`src/app/layout.tsx`)

- `<html>` : `lang="fr" antialiased` + variables font injectées via `className`
- `<body>` : `min-h-full bg-background font-sans text-foreground`

### 8.2 Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

**Structure grid** (desktop) :

```
┌────────────────────┬──────────────────────────────────────┐
│ Sidebar            │ Topbar                               │
│ w-[17rem]          ├──────────────────────────────────────┤
│ sticky             │ Main content                         │
│                    │ px-4 sm:px-5 lg:px-8                 │
│                    │ py-4 sm:py-6 lg:py-8                 │
└────────────────────┴──────────────────────────────────────┘
```

Tailwind : `lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]`  
Background page : `bg-#f6f7f8`  
Main : `min-w-0 flex-1 overflow-x-hidden`

---

## 9. États interactifs

### Hover

- Boutons CTA : `hover:opacity-90` ou `hover:bg-[couleur-légèrement-plus-foncée]`
- Liens nav : `hover:bg-#f0f2f4`
- Cards cliquables : `hover:border-steel/30`
- Chips inactifs : `hover:border-#15323f/30 hover:bg-#f6f7f8`

### Focus (accessibilité clavier)

Tous les inputs, selects, textareas : `focus:ring-2 focus:ring-steel/25 focus:outline-none`

### Loading / Pending

- Icône `<Loader2 className="animate-spin" />` de Lucide
- Boutons en attente : `disabled:opacity-50` ou `disabled:opacity-60`
- Transitions React : `useTransition()` + état `isPending`

### Disabled

- `opacity-50` pour les boutons non disponibles
- Étapes pipeline futures : `opacity-45 cursor-not-allowed`

### Active / Sélectionné

- Nav links : `bg-#15323f text-#f3f7fa`
- Chips : `border-steel bg-steel text-steel-ink`
- Tabs : border-bottom steel + texte steel

---

## 10. Responsive

### Breakpoints (Tailwind defaults)

| Breakpoint | Largeur |
|---|---|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

### Patterns clés

| Pattern | Mobile | Desktop |
|---|---|---|
| Sidebar | Cachée, nav en drawer | `sticky left-0 w-[17rem]` |
| Cockpit grid | `grid-cols-1` | `grid-cols-[300px_1fr_320px]` |
| Dossier champs | `grid-cols-1` | `md:grid-cols-2 xl:grid-cols-4` |
| Padding page | `px-4 py-4` | `lg:px-8 lg:py-8` |
| Typography body | `text-[13px]` | `lg:text-[15px]` |
| KPI cards | `grid-cols-2` | `grid-cols-4` |

### Mobile nav

`DashboardMobileNav` : drawer latéral, `z-40`, contient sidebar-nav + BrandLogoBlock variant="drawer".

---

## 11. Accessibilité

- HTML sémantique : `<nav>`, `<main>`, `<aside>`, `<header>`, `<section>`, `<article>`
- Icônes décoratives : `aria-hidden="true"`
- Icônes fonctionnelles : `aria-label="..."` sur le bouton parent
- Labels de formulaire : `<label htmlFor="...">` associés
- Messages d'erreur : `role="alert"`
- Status live : `role="status"` pour les mises à jour dynamiques
- Contrastes : les paires de couleurs texte/fond respectent WCAG AA (4.5:1 pour corps, 3:1 pour grands textes)

---

## 12. Patterns UX

### Pipeline Guard

Chaque transition de statut est gardée côté serveur (Server Action). Le bouton "Suivant" du `lead-pipeline-step-nav` est désactivé si les prérequis ne sont pas remplis (ex: lead non qualifié ne peut pas passer à `agency_assignment`).

### Mode IA vs Manuel

Le lead a un `workflow_mode` : `ai` ou `manual`. En mode IA, les actions de qualification et scoring sont déclenchées automatiquement. En mode manuel, l'opérateur remplit les champs lui-même. L'UI adapte les CTAs et les banners en conséquence.

### Information hierarchy dans les cartes lead

1. **Grade + Score** (haut droite) — première lecture
2. **Statut pipeline** (rail) — où en est-on
3. **Next Action** — que faire maintenant
4. **Détails dossier** — informations complètes

### Feedback immédiat

- Toute Server Action retourne un `{ error?: string }` ou un objet data
- Les erreurs s'affichent inline (pas de toast par défaut)
- Les états pending sont visibles via spinner ou opacity

### Couleur = sens, jamais décoration

Ne jamais utiliser `--revenue` (vert) ou `--hot` (rouge) pour une raison esthétique. Ces couleurs portent une signification métier précise et les utilisateurs apprennent à les lire comme des signaux.

### Densité d'information

Les tables de leads utilisent des lignes compactes (`h-10` par ligne) avec truncation (`truncate`) et tooltips natifs (`title="..."`) pour les textes longs. Ne pas paginer si moins de 100 items — préférer le scroll.

---

*Document généré le 2026-04-21 — à mettre à jour à chaque ajout de composant ou modification des tokens.*
