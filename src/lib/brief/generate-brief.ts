import type { QualificationBlocks } from "@/lib/qualification-blocks";
import { safeQualificationBlocks } from "@/lib/qualification-blocks";

export type BriefInput = {
  reference: string | null;
  traveler_name: string;
  travelers: string;
  trip_dates: string;
  budget: string;
  travel_style: string;
  trip_summary: string;
  destination_main: string | null;
  qualification_notes: string | null;
  qualification_blocks: QualificationBlocks | unknown;
};

function line(label: string, value: string | null | undefined): string {
  return value?.trim() ? `- **${label}** : ${value.trim()}` : "";
}

/** Generate a structured brief for partner agencies (pure function, no AI). */
export function generateBrief(lead: BriefInput): string {
  const blocks = safeQualificationBlocks(lead.qualification_blocks);
  const ref = lead.reference ?? "DA-YYYY-XXXX";
  const name = lead.traveler_name?.trim() || "—";
  const now = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Collect block selections for additional context
  const blockNotes: string[] = [];
  for (const [blockKey, block] of Object.entries(blocks)) {
    if (block.op_selections && block.op_selections.length > 0) {
      const label = blockLabelFr[blockKey as keyof typeof blockLabelFr] ?? blockKey;
      blockNotes.push(`${label} : ${block.op_selections.join(", ")}`);
    }
  }

  const sections: string[] = [];

  sections.push(`# Brief dossier — ${ref}`);
  sections.push(`_Émis le ${now} — Confidentiel, usage interne réseau DA uniquement._`);
  sections.push("");

  sections.push("## Profil voyageurs");
  sections.push(line("Nom de référence", name));
  sections.push(line("Composition", lead.travelers));
  sections.push("");

  sections.push("## Dates et durée");
  sections.push(line("Période / dates", lead.trip_dates));
  sections.push("");

  sections.push("## Budget");
  sections.push(line("Budget indicatif", lead.budget));
  sections.push("");

  sections.push("## Style & attentes");
  sections.push(line("Style de voyage", lead.travel_style));
  if (lead.trip_summary?.trim()) {
    sections.push("");
    sections.push(lead.trip_summary.trim());
  }
  sections.push("");

  if (lead.destination_main?.trim()) {
    sections.push("## Zones d'intérêt");
    sections.push(line("Destination principale", lead.destination_main));
    sections.push("");
  }

  if (blockNotes.length > 0) {
    sections.push("## Qualification détaillée");
    sections.push(blockNotes.map((n) => `- ${n}`).join("\n"));
    sections.push("");
  }

  if (lead.qualification_notes?.trim()) {
    sections.push("## Notes opérateur");
    sections.push(lead.qualification_notes.trim());
    sections.push("");
  }

  sections.push("## Question à l'agence");
  sections.push(
    "Merci de nous retourner une proposition de circuit (itinéraire + prix indicatif) dans les **5 jours ouvrés**. En cas d'indisponibilité ou de circuit non adapté, merci de le signaler sous 48h.",
  );

  return sections.filter((s) => s !== undefined && s !== null).join("\n");
}

const blockLabelFr: Record<string, string> = {
  vibes: "Ambiance",
  group: "Groupe",
  timing: "Temporalité",
  stay: "Hébergement",
  highlights: "Points forts",
  budget: "Budget",
};
