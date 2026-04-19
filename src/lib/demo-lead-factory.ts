import type { LeadTimelineItem, MockLead } from "@/lib/mock-leads";

const today = () =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

export function createDemoLead(input: {
  travelerName: string;
  email: string;
  tripSummary: string;
  budget: string;
  priority?: "normal" | "high";
}): MockLead {
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const d = today();
  const timeline: LeadTimelineItem[] = [
    {
      id: `${id}-t1`,
      label: "Lead créé",
      detail: "Ajout depuis le tableau des leads.",
      date: d,
    },
  ];

  return {
    id,
    travelerName: input.travelerName.trim(),
    email: input.email.trim(),
    phone: "+33 6 00 00 00 00",
    status: "new",
    source: "Saisie manuelle",
    tripSummary: input.tripSummary.trim(),
    travelStyle: "Sur mesure",
    travelers: "À préciser",
    budget: input.budget,
    dates: "À définir",
    qualificationSummary:
      "Nouvelle demande à qualifier : préciser le nombre de voyageurs, le niveau d’hébergement et le rythme souhaité.",
    internalNotes: "—",
    assignedAgency: "Non assignée",
    quoteStatus: "Pas de devis",
    agencyLinks: [],
    retainedAgencyId: null,
    timeline,
    priority: input.priority ?? "normal",
    starred: false,
  };
}

export function timelineEntry(
  label: string,
  detail: string,
): LeadTimelineItem {
  return {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    detail,
    date: today(),
  };
}
