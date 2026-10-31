import { Resend, type CreateEmailRequestOptions } from "resend";

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
  /** Intake must finish before its site relay deadline; abort the actual provider request. */
  timeoutMs?: number;
}): Promise<EmailSendResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return { ok: false, error: "RESEND_FROM_EMAIL n'est pas configuré." };
  }
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY n'est pas configuré." };
  }

  const controller = Number.isFinite(input.timeoutMs) && input.timeoutMs! > 0 ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.min(input.timeoutMs!, 30_000)) : null;
  // Resend 4.8 forwards these options to fetch (including signal), although its public type only lists query/idempotency.
  const options: CreateEmailRequestOptions & { signal?: AbortSignal } = {
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    ...(controller ? { signal: controller.signal } : {}),
  };
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      replyTo: process.env.NEXT_PUBLIC_DA_CONTACT_EMAIL?.trim() || "contact@directionlalgerie.com",
    }, Object.keys(options).length ? options : undefined);
    if (error) return { ok: false, error: error.message,
      ...(["application_error", "internal_server_error"].includes(error.name) ? { deliveryUnknown: true } : {}) };
    return { ok: true, providerId: data?.id };
  } catch {
    // An interrupted request may already have reached the provider. Do not
    // allow a second dispatch before its delivery state has been checked.
    return { ok: false, deliveryUnknown: true, error: "La confirmation d’envoi du prestataire n’a pas pu être obtenue. Vérifiez l’état du message avant de tenter un nouvel envoi." };
  } finally { if (timer !== null) clearTimeout(timer); }
}
