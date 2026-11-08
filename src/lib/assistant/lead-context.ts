import { anonymizeAgencyText, buildLeadEmailTemplate, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { readDemandeProjet } from "@/lib/demande-projet-intake";

export function assistantLeadContext(lead: LeadEmailTemplateInput) {
  const { analysis } = buildLeadEmailTemplate(lead, "qualification");
  const request = readDemandeProjet(lead.intake_payload);
  const clean = (value?: string | null) => anonymizeAgencyText(value ?? "", lead).trim().slice(0, 600);
  return {
    language: analysis.language,
    destinations: clean(lead.destination_main),
    preferences: clean(lead.travel_style),
    initialRequest: request ? {
      destinations: request.destination.names.slice(0, 20).map(clean),
      wishes: request.wishes.selection.slice(0, 12).map(({ name }) => clean(name)),
    } : undefined,
    confirmed: analysis.checklist
      .filter(({ id, status }) => status === "complete" && ["dates", "duration", "participants", "accommodation", "budget"].includes(id))
      .map(({ id, value }) => ({ id, value: clean(value) })),
    missing: analysis.questions.map(({ id, label }) => ({ id, label })),
  };
}
