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

const DA_WHATSAPP_NUMBER = "213795274309"; // +213 7 95 27 43 09 (fallback hardcodé)

function logoHeader(): string {
  return `
  <table style="width:100%;margin-bottom:24px;border-bottom:2px solid #15323f;padding-bottom:16px;">
    <tr>
      <td style="vertical-align:middle;">
        <span style="font-size:20px;font-weight:700;color:#15323f;letter-spacing:0.02em;">Direction l'Algérie</span>
        <br><span style="font-size:11px;color:#9aa7b0;letter-spacing:0.08em;text-transform:uppercase;">Voyages sur mesure</span>
      </td>
    </tr>
  </table>`;
}

function signatureBlock(waNumber: string): string {
  const waFormatted = `+${waNumber.replace(/^(\d{3})(\d{3})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5")}`;
  return `
  <table style="width:100%;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;">
    <tr>
      <td style="font-size:13px;color:#64748b;line-height:1.7;">
        <strong style="color:#15323f;">Direction l'Algérie</strong><br>
        Voyages sur mesure en Algérie<br>
        <a href="https://wa.me/${waNumber}" style="color:#25D366;text-decoration:none;">WhatsApp : ${waFormatted}</a><br>
        <a href="mailto:contact@directionlalgerie.com" style="color:#1e5a8a;text-decoration:none;">contact@directionlalgerie.com</a>
      </td>
    </tr>
  </table>`;
}

/** Mode IA : CTA WhatsApp dominant (vert, grand) + email secondaire (discret). */
export function buildWorkflowWelcomeEmailAiHtml(
  lead: WorkflowLeadEmailFields,
  opts: { whatsappHref: string; mailtoHref: string },
): string {
  const name = escapeHtml(firstName(lead.traveler_name));

  // Extract actual wa.me number from href, or fall back to DA hardcoded number
  const waNumberMatch = opts.whatsappHref.match(/wa\.me\/(\d+)/);
  const waNumber = waNumberMatch ? waNumberMatch[1] : DA_WHATSAPP_NUMBER;
  const resolvedWaHref = `https://wa.me/${waNumber}${opts.whatsappHref.includes("?") ? opts.whatsappHref.slice(opts.whatsappHref.indexOf("?")) : ""}`;
  const hasWhatsapp = waNumber.length >= 8;

  const whatsappBlock = hasWhatsapp
    ? `
  <table style="margin:28px auto;text-align:center;width:100%;">
    <tr>
      <td style="text-align:center;">
        <p style="margin:0 0 10px;font-size:14px;color:#374151;">Pour un échange plus fluide et un suivi en temps réel, nous vous recommandons WhatsApp. Cliquez ci-dessous pour démarrer la conversation.</p>
        <a href="${escapeHtml(resolvedWaHref)}"
           style="display:inline-block;background:#25D366;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:17px;letter-spacing:0.01em;">
          💬 Continuer sur WhatsApp
        </a>
      </td>
    </tr>
  </table>`
    : `<p style="margin:20px 0;font-size:14px;color:#6b7280;">(Aucun numéro WhatsApp disponible — répondez à cet email pour démarrer votre projet.)</p>`;

  return `
<div style="${baseStyles()}">
  ${logoHeader()}
  <p>Bonjour ${name},</p>
  <p>Nous avons bien reçu votre demande de voyage. <strong>Direction l'Algérie</strong> sélectionne pour vous les agents experts de notre réseau pour construire un voyage sur mesure.</p>
  <p>Voici le récapitulatif de votre projet&nbsp;:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">${projectRecapRows(lead)}</table>
  ${whatsappBlock}
  <p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:8px;">
    Vous préférez l'email ?
    <a href="${escapeHtml(opts.mailtoHref)}" style="color:#1e293b;text-decoration:underline;">Répondre par email</a>
  </p>
  <p style="font-size:14px;color:#64748b;margin-top:16px;">Nous restons à votre disposition pour toute question.</p>
  ${signatureBlock(waNumber)}
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
