import { escapeHtml } from "@/lib/email/html";

export type WorkflowLeadEmailFields = {
  traveler_name: string;
  trip_summary: string;
  travel_style: string;
  travelers: string;
  budget: string;
  trip_dates: string;
};

function firstName(full: string): string {
  const t = full.trim().split(/\s+/)[0];
  return t || "Bonjour";
}

function projectRecapRows(lead: WorkflowLeadEmailFields): string {
  const rows: [string, string][] = [
    ["Groupe", lead.travelers],
    ["Période / dates", lead.trip_dates],
    ["Style", lead.travel_style],
    ["Budget", lead.budget],
    ["Projet", lead.trip_summary],
  ];
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">${escapeHtml(k)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(v.trim() || "—")}</td></tr>`,
    )
    .join("");
}

function baseStyles(): string {
  return `font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#0f172a;max-width:560px;`;
}

/** Mode IA : double CTA WhatsApp + email (mailto). */
export function buildWorkflowWelcomeEmailAiHtml(
  lead: WorkflowLeadEmailFields,
  opts: { whatsappHref: string; mailtoHref: string },
): string {
  const name = escapeHtml(firstName(lead.traveler_name));
  return `
<div style="${baseStyles()}">
  <p>Bonjour ${name},</p>
  <p>Nous avons bien reçu votre demande de voyage. <strong>Direction l'Algérie</strong> sélectionne pour vous les agents experts de notre réseau pour construire un voyage sur mesure.</p>
  <p>Voici le récapitulatif de votre projet&nbsp;:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">${projectRecapRows(lead)}</table>
  <p>Pour affiner votre projet avec nous, vous pouvez&nbsp;:</p>
  <p style="margin:20px 0;">
    <a href="${escapeHtml(opts.whatsappHref)}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-right:8px;margin-bottom:8px;">Co-construire par WhatsApp</a>
    <a href="${escapeHtml(opts.mailtoHref)}" style="display:inline-block;background:#1e293b;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:8px;">Poursuivre par email</a>
  </p>
  <p style="font-size:14px;color:#64748b;">Nous restons à votre disposition pour toute question.</p>
  <p>— L'équipe Direction l'Algérie</p>
</div>`.trim();
}

/** Mode manuel (email optionnel) : pas de CTA canaux. */
export function buildWorkflowWelcomeEmailSimpleHtml(lead: WorkflowLeadEmailFields): string {
  const name = escapeHtml(firstName(lead.traveler_name));
  return `
<div style="${baseStyles()}">
  <p>Bonjour ${name},</p>
  <p>Nous avons bien reçu votre demande de voyage. <strong>Direction l'Algérie</strong> sélectionne pour vous les agents experts de notre réseau.</p>
  <p>Voici le récapitulatif de votre projet&nbsp;:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">${projectRecapRows(lead)}</table>
  <p>Nous revenons vers vous très prochainement.</p>
  <p>— L'équipe Direction l'Algérie</p>
</div>`.trim();
}

export function buildWorkflowReplyMailto(
  ref: string,
  contactEmail: string,
): string {
  const subject = encodeURIComponent(`Projet voyage — réf. ${ref}`);
  const body = encodeURIComponent(
    `Bonjour,\n\nJe souhaite poursuivre mon projet (référence : ${ref}).\n\n`,
  );
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

/** Chiffres uniquement pour wa.me (ex. 33612345678). */
export function normalizeWhatsAppE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}
