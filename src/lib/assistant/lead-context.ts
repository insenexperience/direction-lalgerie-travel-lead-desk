import { anonymizeAgencyText, buildLeadEmailTemplate, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";
import { readDemandeProjet } from "@/lib/demande-projet-intake";
import { parseQualificationImport, qualificationLabels } from "@/lib/assistant/qualification";

export function assistantLeadContext(lead: LeadEmailTemplateInput & { priority?: unknown }) {
  const { analysis } = buildLeadEmailTemplate(lead, "qualification");
  const request = readDemandeProjet(lead.intake_payload);
  const intake = lead.intake_payload as { da_sales_qualification?: unknown } | null;
  const imported = parseQualificationImport(intake?.da_sales_qualification);
  const clean = (value?: string | null) => anonymizeAgencyText(value ?? "", lead).trim().slice(0, 600);
  return {
    language: analysis.language,
    priority: lead.priority === "high" ? "high" : "normal",
    derniereQualification: imported ? qualificationLabels(imported).map(({ label, value }) => ({ label, value: clean(value) })) : undefined,
    destinationPrincipale: clean(lead.destination_main),
    preferences: clean(lead.travel_style),
    initialRequest: request ? {
      destinationsSouhaitees: request.destination.names.slice(0, 20).map(clean),
      wishes: request.wishes.selection.slice(0, 12).map(({ name }) => clean(name)),
    } : undefined,
    confirmed: analysis.checklist
      .filter(({ id, status }) => status === "complete" && ["dates", "duration", "participants", "accommodation", "budget"].includes(id))
      .map(({ id, value }) => ({ id, value: clean(value) })),
    missing: analysis.questions.map(({ id, label }) => ({ id, label })),
  };
}
