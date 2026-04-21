import { QUALIFICATION_BLOCKS_CONFIG } from '@/components/leads/qualification/qualification-blocks-config';
import type { BlockId } from '@/lib/qualification-blocks';

function buildOptionsReference(): string {
  return QUALIFICATION_BLOCKS_CONFIG.map(block => {
    const sectionsText = block.sections.map(section => {
      const optionsText = section.options.map(o => `    - "${o.id}": ${o.label}`).join('\n');
      return `  Section "${section.id}" (${section.label}, multi=${section.multi}, required=${section.required}):\n${optionsText}`;
    }).join('\n');
    return `Bloc "${block.id}" — ${block.label}:\n${sectionsText}`;
  }).join('\n\n');
}

export const QUALIFICATION_SUGGESTIONS_SYSTEM_PROMPT = `Tu es un expert en tourisme haut de gamme spécialisé dans les voyages en Algérie pour l'agence Direction l'Algérie.

Ta mission : analyser les informations d'un dossier voyageur et proposer des suggestions structurées pour qualifier le projet de voyage selon 6 dimensions.

## Options disponibles par bloc

${buildOptionsReference()}

## Règle absolue
- Tu ne peux suggérer QUE des IDs qui existent dans la liste ci-dessus
- Tout ID non listé doit être ignoré
- Si une information est absente ou ambiguë, laisse le tableau "suggestions" vide pour la section concernée et mentionne-la dans "missing"

## Format de réponse JSON strict

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication :

{
  "vibes": {
    "suggestions": ["id1", "id2"],
    "confidence": 0.85,
    "missing": ["id_section_manquante"]
  },
  "group": {
    "suggestions": ["id1"],
    "confidence": 0.70,
    "missing": []
  },
  "timing": {
    "suggestions": ["id1", "id2"],
    "confidence": 0.60,
    "missing": ["flexibility"]
  },
  "stay": {
    "suggestions": ["id1"],
    "confidence": 0.75,
    "missing": []
  },
  "highlights": {
    "suggestions": ["id1", "id2"],
    "confidence": 0.80,
    "missing": []
  },
  "budget": {
    "suggestions": ["id1"],
    "confidence": 0.90,
    "missing": []
  }
}

## Règles de confiance
- 0.85–1.0 : information explicite et claire dans le dossier
- 0.60–0.84 : information implicite ou déduite
- 0.30–0.59 : faible signal, estimation probable
- 0.0–0.29 : quasi-inconnu, ne pas suggérer (laisser suggestions vide)

## Règles métier Algérie
- Un voyage au Sahara implique souvent "bivouac" ou "mix" pour l'hébergement
- Un groupe famille avec enfants → physical_level "easy" ou "moderate"
- Les voyages culturels au nord de l'Algérie sont différents des circuits désertiques du sud
- Le budget "Économique" ne peut pas coexister avec des hôtels 4–5 étoiles`;

export interface QualificationSuggestionsInput {
  blockIds: BlockId[];
  intakePayload: unknown;
  conversationTranscript: unknown;
  surfaceFields: {
    destination_main: string | null;
    trip_dates: string | null;
    travelers: string | null;
    budget: string | null;
    travel_style: string | null;
    trip_summary: string | null;
    travel_desire_narrative: string | null;
  };
}

export function buildQualificationSuggestionsUserPrompt(input: QualificationSuggestionsInput): string {
  const lines: string[] = ['## Dossier voyageur'];

  if (input.surfaceFields.destination_main) {
    lines.push(`Destination : ${input.surfaceFields.destination_main}`);
  }
  if (input.surfaceFields.trip_dates) {
    lines.push(`Dates / période : ${input.surfaceFields.trip_dates}`);
  }
  if (input.surfaceFields.travelers) {
    lines.push(`Composition du groupe : ${input.surfaceFields.travelers}`);
  }
  if (input.surfaceFields.budget) {
    lines.push(`Budget indicatif : ${input.surfaceFields.budget}`);
  }
  if (input.surfaceFields.travel_style) {
    lines.push(`Style de voyage : ${input.surfaceFields.travel_style}`);
  }
  if (input.surfaceFields.trip_summary) {
    lines.push(`Résumé du projet : ${input.surfaceFields.trip_summary}`);
  }
  if (input.surfaceFields.travel_desire_narrative) {
    lines.push(`Désirs narratifs : ${input.surfaceFields.travel_desire_narrative}`);
  }

  if (input.intakePayload && typeof input.intakePayload === 'object') {
    lines.push('\n## Formulaire d\'intake (JSON)');
    lines.push(JSON.stringify(input.intakePayload, null, 2));
  }

  if (input.conversationTranscript) {
    const transcript = Array.isArray(input.conversationTranscript)
      ? input.conversationTranscript
      : [];
    if (transcript.length > 0) {
      lines.push('\n## Conversation WhatsApp');
      for (const msg of transcript.slice(-20)) {
        if (msg && typeof msg === 'object') {
          const m = msg as Record<string, unknown>;
          const role = m.role === 'assistant' ? 'DA' : 'Voyageur';
          lines.push(`${role}: ${String(m.content ?? '')}`);
        }
      }
    }
  }

  const blockLabels = input.blockIds.map(id => {
    const config = QUALIFICATION_BLOCKS_CONFIG.find(c => c.id === id);
    return config ? `"${id}" (${config.label})` : `"${id}"`;
  });

  lines.push(`\n## Blocs à qualifier`);
  lines.push(`Traite uniquement ces blocs : ${blockLabels.join(', ')}`);
  lines.push('Pour les autres blocs, retourne suggestions=[] et confidence=0.');

  return lines.join('\n');
}
