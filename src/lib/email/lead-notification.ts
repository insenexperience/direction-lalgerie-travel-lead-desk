import { sendTransactionalHtmlEmail, type EmailSendResult } from "@/lib/email/resend-client";
import { buildDemandeEmailSummary } from "@/lib/email/demande-receipt";

/**
 * Prévient l'équipe qu'un lead vient d'arriver.
 *
 * Sans cela, une demande peut rester en base sans que personne ne le sache —
 * et la promesse de réponse sous 48 h faite au voyageur sur le site n'a alors
 * aucun destinataire humain.
 */

const echapper = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Destinataire de l'alerte, avec un repli sur la boîte de contact. */
function destinataire(): string {
  return (
    process.env.LEAD_NOTIFY_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() ||
    "contact@directionlalgerie.com"
  );
}

function lienDossier(leadId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() || "https://app.directionlalgerie.com"
  ).replace(/\/$/, "");
  return `${base}/leads/${encodeURIComponent(leadId)}`;
}

/** Échéance de la première réponse (48 h), à l’heure d’Alger. */
function echeance(): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Algiers", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(Date.now() + 48 * 36e5));
}

const LIGNES: Array<[string, string]> = [
  ["Email", "email"],
  ["Téléphone", "phone"],
  ["Préférence de contact", "follow_prefs"],
  ["Voyageurs", "group_type"],
  ["Nombre", "travellers_count"],
  ["Période", "flex_period"],
  ["Durée", "flex_duration"],
  ["Budget", "budget_total"],
  ["Hébergement", "hebergements"],
  ["Envie", "vision"],
  ["Page d'origine", "page_origin"],
];

export async function notifierNouveauLead(input: {
  leadId: string;
  intake: Record<string, unknown>;
}): Promise<EmailSendResult> {
  const { leadId, intake } = input;
  const nom = echapper(intake.full_name) || "(sans nom)";
  const summary = buildDemandeEmailSummary(intake);
  const deadline = `Première réponse au voyageur attendue avant le ${echeance()}.`;

  const lignes = LIGNES.filter(([, cle]) => String(intake[cle] ?? "").trim())
    .map(
      ([libelle, cle]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7780;white-space:nowrap">${libelle}</td>` +
        `<td style="padding:4px 0;color:#182b35"><strong>${echapper(intake[cle])}</strong></td></tr>`,
    )
    .join("");

  const notes = String(intake.notes_longues ?? "").trim();
  const blocNotes = notes
    ? `<p style="margin:18px 0 0;color:#6b7780;font-size:13px">Demande</p>
       <pre style="margin:4px 0 0;padding:12px;background:#f4f7fa;border-radius:4px;white-space:pre-wrap;font:13px/1.6 ui-monospace,monospace;color:#182b35">${echapper(notes)}</pre>`
    : "";

  const html = `<div style="font:15px/1.6 system-ui,sans-serif;color:#182b35;max-width:640px">
    <p style="margin:0 0 4px;color:#6b7780;font-size:13px">Nouveau projet de voyage</p>
    <h1 style="margin:0 0 18px;font-size:22px">${nom}</h1>
    <table style="border-collapse:collapse;font-size:14px">${lignes}</table>
    ${summary ? `<h2 style="font-size:18px;margin-top:22px">Demande du voyageur</h2>${summary.html}` : blocNotes}
    <p style="margin:24px 0 0">
      <a href="${lienDossier(leadId)}" style="background:#182b35;color:#fff;padding:11px 18px;text-decoration:none;border-radius:4px;display:inline-block">Ouvrir le dossier</a>
    </p>
    <p style="margin:18px 0 0;color:#6b7780;font-size:12px">${echapper(deadline)}</p>
  </div>`;

  const plainName = String(intake.full_name ?? "").replace(/[\r\n]+/g, " ").trim() || "(sans nom)";
  const text = ["Nouveau projet de voyage", plainName,
    LIGNES.filter(([, key]) => String(intake[key] ?? "").trim()).map(([label, key]) => `${label} : ${String(intake[key])}`).join("\n"),
    summary?.text || notes, `Ouvrir le dossier : ${lienDossier(leadId)}`, deadline].filter(Boolean).join("\n\n");
  const resultat = await sendTransactionalHtmlEmail({
    to: destinataire(),
    subject: `Nouveau projet — ${plainName}`.slice(0, 250),
    html,
    text,
    idempotencyKey: `intake-team-${leadId}`,
    timeoutMs: 5000,
  });

  if (!resultat.ok) {
    // Bruyant volontairement : un lead non signalé est un lead perdu.
    console.error(
      "[lead-notification] ÉCHEC de l'alerte pour le lead",
      leadId,
      resultat.deliveryUnknown ? "— confirmation prestataire inconnue" : "— échec de transmission",
    );
    return resultat;
  }
  return resultat;
}
