import { buildLeadEmailTemplate, renderLeadEmailHtml, type LeadEmailTemplateInput } from "@/lib/email/lead-email-template";

/** Legacy callers share the reviewed Direction l’Algérie template. */
export type WorkflowLeadEmailFields = LeadEmailTemplateInput & {
  traveler_name: string;
  trip_summary: string;
  travel_style: string;
  travelers: string;
  budget: string;
  trip_dates: string;
};

export function buildWorkflowWelcomeEmailAiHtml(lead: WorkflowLeadEmailFields, opts: { whatsappHref: string; mailtoHref: string }): string {
  const template = buildLeadEmailTemplate(lead, "welcome");
  return renderLeadEmailHtml({ kind: "welcome", language: template.language, bodyText: template.bodyText,
    travelerName: lead.traveler_name, reference: template.reference, ...opts });
}

export function buildWorkflowWelcomeEmailSimpleHtml(lead: WorkflowLeadEmailFields): string {
  return buildLeadEmailTemplate(lead, "welcome").html;
}

export function buildWorkflowReplyMailto(ref: string, contactEmail: string): string {
  const subject = encodeURIComponent(`Projet voyage — réf. ${ref}`);
  const body = encodeURIComponent(`Bonjour,\n\nJe souhaite poursuivre mon projet (référence : ${ref}).\n\n`);
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

/** Chiffres uniquement pour wa.me (ex. 33612345678). */
export function normalizeWhatsAppE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
