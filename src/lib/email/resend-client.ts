import { Resend } from "resend";

export type EmailSendResult = { ok: true } | { ok: false; error: string };

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendTransactionalHtmlEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    return { ok: false, error: "RESEND_FROM_EMAIL n'est pas configuré." };
  }
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY n'est pas configuré." };
  }

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
