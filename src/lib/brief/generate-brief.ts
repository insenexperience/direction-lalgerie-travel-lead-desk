import type { QualificationBlocks } from "@/lib/qualification-blocks";
import { safeQualificationBlocks } from "@/lib/qualification-blocks";
import { calculateLeadBudget, formatEur } from "@/lib/pipeline-calculations";

export type BriefInput = {
  reference: string | null;
  travelers: string;
  trip_dates: string;
  budget: string;
  travel_style: string;
  trip_summary: string;
  destination_main: string | null;
  qualification_notes: string | null;
  qualification_blocks: QualificationBlocks | unknown;
  // Champs budget structurés (prioritaires sur le champ texte)
  budget_min?: number | null;
  budget_max?: number | null;
  budget_unit?: "per_person" | "total" | null;
  travelers_adults?: number | null;
  travelers_children?: number | null;
};

function line(label: string, value: string | null | undefined): string {
  return value?.trim() ? `- **${label}** : ${value.trim()}` : "";
}

function formatBudget(lead: BriefInput): string {
  const min = lead.budget_min ?? 0;
  if (min > 0 && lead.budget_unit) {
    const adults = Math.max(0, lead.travelers_adults ?? 0);
    const children = Math.max(0, lead.travelers_children ?? 0);
    const total = calculateLeadBudget({
      budget_min: min,
      budget_unit: lead.budget_unit,
      travelers_adults: adults,
      travelers_children: children,
      status: "",
      deleted_at: null,
    });
    if (lead.budget_unit === "per_person") {
      return `${formatEur(min)} / pers. · ${formatEur(total)} groupe`;
    }
    return `${formatEur(total)} (budget total)`;
  }
  // Fallback legacy text field
  return lead.budget?.trim() || "—";
}

/** Generate a structured brief for partner agencies (anonymized — no traveler contact info). */
export function generateBrief(lead: BriefInput): string {
  const blocks = safeQualificationBlocks(lead.qualification_blocks);
  const ref = lead.reference ?? "DA-YYYY-XXXX";
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
  sections.push(`_Les coordonnées du voyageur sont confidentielles et gérées exclusivement par Direction l'Algérie._`);
  sections.push("");

  sections.push("## Profil du groupe");
  sections.push(line("Composition", lead.travelers));
  sections.push("");

  sections.push("## Dates et durée");
  sections.push(line("Période / dates", lead.trip_dates));
  sections.push("");

  sections.push("## Budget");
  sections.push(`- **Budget indicatif** : ${formatBudget(lead)}`);
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
  sections.push("");
  sections.push("_Pour toute question, contactez Direction l'Algérie — ne contacter pas directement le voyageur._");

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
