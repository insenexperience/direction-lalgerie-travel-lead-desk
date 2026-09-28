import { sendTransactionalHtmlEmail } from "@/lib/email/resend-client";

/**
 * Accusé de réception automatique au voyageur (décision D6, refonte v3).
 *
 * Il dit seulement que le projet est bien arrivé et qu'une personne répond sous 48 h :
 * ni nom d'agence, ni promesse de prix. La première réponse humaine reste un geste de l'opérateur.
 *
 * Désactivé tant que `TRAVELER_ACK_ENABLED` ne vaut pas « 1 » : l'adresse d'expédition
 * (contact@) doit d'abord recevoir les réponses des voyageurs.
 */
export const accuseReceptionActif = () => process.env.TRAVELER_ACK_ENABLED?.trim() === "1";

const echapper = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const texteAccuse = (prenom: string) =>
  `Bonjour ${prenom},\n\nVotre projet de voyage est bien arrivé chez Direction l'Algérie. Une personne de notre équipe vous répond sous 48 h, pour vous dire chez quelle agence partenaire il part et quand arrive votre proposition.\n\nPour toute précision, répondez simplement à ce message.\n\nDirection l'Algérie`;

export async function envoyerAccuseReception(input: { email: string; nom: string }): Promise<{ ok: boolean; texte: string; error?: string }> {
  const prenom = input.nom.trim().split(/\s+/)[0] || "et bienvenue";
  const texte = texteAccuse(prenom);
  if (!accuseReceptionActif()) return { ok: false, texte, error: "désactivé" };
  const html = `<div style="font:15px/1.6 system-ui,sans-serif;color:#182b35;max-width:560px">${echapper(texte)
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;
  const r = await sendTransactionalHtmlEmail({ to: input.email, subject: "Votre projet est bien arrivé", html });
  return r.ok ? { ok: true, texte } : { ok: false, texte, error: r.error };
}
