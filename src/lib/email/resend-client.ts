import { Resend } from "resend";

export type EmailSendResult = { ok: true; providerId?: string } | { ok: false; error: string; deliveryUnknown?: boolean };

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendTransactionalHtmlEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}): Promise<EmailSendResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return { ok: false, error: "RESEND_FROM_EMAIL n'est pas configuré." };
  }
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY n'est pas configuré." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      replyTo: process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() || "contact@directionlalgerie.com",
    }, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined);
    if (error) return { ok: false, error: error.message,
      ...(["application_error", "internal_server_error"].includes(error.name) ? { deliveryUnknown: true } : {}) };
    return { ok: true, providerId: data?.id };
  } catch {
    // An interrupted request may already have reached the provider. Do not
    // allow a second dispatch before its delivery state has been checked.
    return { ok: false, deliveryUnknown: true, error: "La confirmation d’envoi du prestataire n’a pas pu être obtenue. Vérifiez l’état du message avant de tenter un nouvel envoi." };
  }
}
