import {
  Compass,
  Users,
  Calendar,
  Home,
  Star,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { BlockId } from '@/lib/qualification-blocks';

export interface BlockOption {
  id: string;
  label: string;
}

export interface BlockSection {
  id: string;
  label: string;
  multi: boolean;
  required: boolean;
  options: BlockOption[];
}

export interface BlockConfig {
  id: BlockId;
  order: number;
  label: string;
  icon: LucideIcon;
  description: string;
  sections: BlockSection[];
}

export const QUALIFICATION_BLOCKS_CONFIG: BlockConfig[] = [
  {
    id: 'vibes',
    order: 1,
    label: 'Ambiance & type de voyage',
    icon: Compass,
    description: "L'émotion recherchée, le pourquoi du voyage",
    sections: [
      {
        id: 'experiences',
        label: 'Expériences recherchées',
        multi: true,
        required: true,
        options: [
          { id: 'nature', label: 'Nature & paysages' },
          { id: 'adventure', label: 'Aventure' },
          { id: 'cultural', label: 'Culturel & histoire' },
          { id: 'immersion', label: 'Immersion locale' },
          { id: 'astronomy', label: 'Astronomie nocturne' },
          { id: 'photo', label: 'Photographique' },
          { id: 'spiritual', label: 'Spirituel' },
          { id: 'gastro', label: 'Gastronomique' },
        ],
      },
      {
        id: 'pace',
        label: 'Rythme',
        multi: false,
        required: true,
        options: [
          { id: 'intense', label: 'Intensif' },
          { id: 'slow', label: 'Contemplatif' },
          { id: 'balanced', label: 'Équilibré' },
        ],
      },
      {
        id: 'structure',
        label: 'Structure du voyage',
        multi: false,
        required: true,
        options: [
          { id: 'fixed', label: 'Itinéraire fixe' },
          { id: 'flexible', label: 'Trame souple' },
          { id: 'full_trust', label: 'Confiance totale guide' },
        ],
      },
    ],
  },
  {
    id: 'group',
    order: 2,
    label: 'Composition du groupe',
    icon: Users,
    description: 'Qui voyage, âge, capacité physique',
    sections: [
      {
        id: 'size',
        label: 'Taille du groupe',
        multi: false,
        required: true,
        options: [
          { id: 'solo', label: 'Solo' },
          { id: 'couple', label: 'Couple' },
          { id: 'small_group', label: 'Petit groupe (3–6)' },
          { id: 'medium_group', label: 'Groupe (7–15)' },
          { id: 'large_group', label: 'Grand groupe (15+)' },
        ],
      },
      {
        id: 'profile',
        label: 'Profil du groupe',
        multi: true,
        required: false,
        options: [
          { id: 'family_young', label: 'Famille avec enfants' },
          { id: 'family_teen', label: 'Famille avec ados' },
          { id: 'seniors', label: 'Séniors' },
          { id: 'friends', label: 'Amis' },
          { id: 'corporate', label: 'Groupe professionnel' },
          { id: 'honeymoon', label: 'Lune de miel' },
        ],
      },
      {
        id: 'physical_level',
        label: 'Niveau physique',
        multi: false,
        required: true,
        options: [
          { id: 'easy', label: 'Facile — pas de randonnée' },
          { id: 'moderate', label: 'Modéré — quelques marches' },
          { id: 'active', label: 'Actif — randonnées régulières' },
          { id: 'challenging', label: 'Sportif — terrains difficiles' },
        ],
      },
    ],
  },
  {
    id: 'timing',
    order: 3,
    label: 'Temporalité',
    icon: Calendar,
    description: 'Durée, période, flexibilité des dates',
    sections: [
      {
        id: 'duration',
        label: 'Durée souhaitée',
        multi: false,
        required: true,
        options: [
          { id: 'weekend', label: 'Week-end (2–4 j)' },
          { id: 'week', label: 'Une semaine (5–8 j)' },
          { id: 'two_weeks', label: 'Deux semaines (9–15 j)' },
          { id: 'long', label: 'Long séjour (16+ j)' },
        ],
      },
      {
        id: 'season',
        label: 'Période / saison',
        multi: true,
        required: true,
        options: [
          { id: 'spring', label: 'Printemps (mars–mai)' },
          { id: 'summer', label: 'Été (juin–août)' },
          { id: 'autumn', label: 'Automne (sept–nov)' },
          { id: 'winter', label: 'Hiver (déc–fév)' },
        ],
      },
      {
        id: 'flexibility',
        label: 'Flexibilité des dates',
        multi: false,
        required: false,
        options: [
          { id: 'fixed_dates', label: 'Dates fixes' },
          { id: 'week_flexible', label: 'Flexibles à ±1 semaine' },
          { id: 'month_flexible', label: 'Flexibles au mois' },
          { id: 'fully_flexible', label: 'Totalement flexibles' },
        ],
      },
    ],
  },
  {
    id: 'stay',
    order: 4,
    label: 'Hébergement',
    icon: Home,
    description: 'Type de logement, confort attendu',
    sections: [
      {
        id: 'accommodation_type',
        label: "Type d'hébergement",
        multi: true,
        required: true,
        options: [
          { id: 'bivouac', label: 'Bivouac / camping' },
          { id: 'gite', label: 'Gîte / auberge' },
          { id: 'riad', label: "Riad / maison d'hôtes" },
          { id: 'hotel_3', label: 'Hôtel 3 étoiles' },
          { id: 'hotel_4_5', label: 'Hôtel 4–5 étoiles' },
          { id: 'mix', label: 'Mix (bivouac + hôtel)' },
        ],
      },
      {
        id: 'comfort',
        label: 'Niveau de confort',
        multi: false,
        required: true,
        options: [
          { id: 'basic', label: 'Basique — authenticité avant tout' },
          { id: 'standard', label: 'Standard — confortable' },
          { id: 'premium', label: 'Premium — haut de gamme' },
          { id: 'luxury', label: 'Luxe — excellence' },
        ],
      },
    ],
  },
  {
    id: 'highlights',
    order: 5,
    label: 'Incontournables & contraintes',
    icon: Star,
    description: 'Must-have, à éviter, contraintes spécifiques',
    sections: [
      {
        id: 'must_see',
        label: 'Incontournables',
        multi: true,
        required: false,
        options: [
          { id: 'sahara', label: 'Sahara / dunes' },
          { id: 'hoggar', label: 'Hoggar / Tamanrasset' },
          { id: 'tassili', label: 'Tassili n\'Ajjer' },
          { id: 'ghardaia', label: 'Ghardaïa / M\'Zab' },
          { id: 'constantine', label: 'Constantine' },
          { id: 'tipaza', label: 'Tipaza / ruines romaines' },
          { id: 'kabylie', label: 'Kabylie' },
          { id: 'casbah', label: 'Casbah d\'Alger' },
          { id: 'bejaia', label: 'Béjaïa / côte' },
        ],
      },
      {
        id: 'avoid',
        label: 'À éviter',
        multi: true,
        required: false,
        options: [
          { id: 'no_crowds', label: 'Éviter les foules' },
          { id: 'no_long_drives', label: 'Éviter les longs trajets voiture' },
          { id: 'no_extreme_heat', label: 'Éviter chaleur extrême' },
          { id: 'no_cold', label: 'Éviter le froid' },
        ],
      },
      {
        id: 'constraints',
        label: 'Contraintes spécifiques',
        multi: true,
        required: false,
        options: [
          { id: 'halal', label: 'Régime halal strict' },
          { id: 'vegetarian', label: 'Végétarien / végétalien' },
          { id: 'allergies', label: 'Allergies alimentaires' },
          { id: 'mobility', label: 'Mobilité réduite' },
          { id: 'no_alcohol', label: 'Sans alcool' },
          { id: 'child_friendly', label: 'Adapté enfants bas âge' },
        ],
      },
    ],
  },
  {
    id: 'budget',
    order: 6,
    label: 'Budget',
    icon: CreditCard,
    description: 'Fourchette par personne, rapport qualité/prix',
    sections: [
      {
        id: 'range',
        label: 'Fourchette par personne (vol inclus)',
        multi: false,
        required: true,
        options: [
          { id: 'budget_low', label: 'Économique (< 1 500 €)' },
          { id: 'budget_mid', label: 'Moyen (1 500–2 500 €)' },
          { id: 'budget_high', label: 'Confort (2 500–4 000 €)' },
          { id: 'budget_premium', label: 'Premium (4 000–7 000 €)' },
          { id: 'budget_luxury', label: 'Luxe (7 000 €+)' },
        ],
      },
      {
        id: 'value',
        label: 'Rapport qualité/prix attendu',
        multi: false,
        required: false,
        options: [
          { id: 'value_focused', label: 'Meilleur rapport qualité/prix' },
          { id: 'experience_focused', label: 'Expérience avant le prix' },
          { id: 'price_no_object', label: 'Budget non-limitant' },
        ],
      },
      {
        id: 'inclusions',
        label: 'Inclusions souhaitées',
        multi: true,
        required: false,
        options: [
          { id: 'flights', label: 'Vols inclus' },
          { id: 'full_board', label: 'Pension complète' },
          { id: 'half_board', label: 'Demi-pension' },
          { id: 'guide', label: 'Guide francophone' },
          { id: 'transfers', label: 'Transferts aéroport' },
        ],
      },
    ],
  },
];

export function getBlockConfig(id: BlockId): BlockConfig | undefined {
  return QUALIFICATION_BLOCKS_CONFIG.find(c => c.id === id);
}

export function getAllOptionIds(): Set<string> {
  const ids = new Set<string>();
  for (const block of QUALIFICATION_BLOCKS_CONFIG) {
    for (const section of block.sections) {
      for (const option of section.options) {
        ids.add(option.id);
      }
    }
  }
  return ids;
}

export function getBlockOptionIds(blockId: BlockId): Set<string> {
  const config = getBlockConfig(blockId);
  if (!config) return new Set();
  const ids = new Set<string>();
  for (const section of config.sections) {
    for (const option of section.options) {
      ids.add(option.id);
    }
  }
  return ids;
}
