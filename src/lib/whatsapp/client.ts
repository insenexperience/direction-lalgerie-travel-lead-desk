import "server-only";

const GRAPH_VERSION = "v21.0";

function graphToken(): string | undefined {
  return (
    process.env.WHATSAPP_API_TOKEN?.trim() ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    undefined
  );
}

function phoneE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+213${digits}`;
  return `+${digits}`;
}

type SendMessageResult = { ok: true } | { ok: false; error: string };

export async function sendWhatsAppTextMessage(
  phoneNumber: string,
  text: string,
): Promise<SendMessageResult> {
  const token = graphToken();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp non configuré (token ou phone_number_id)." };
  }

  const to = phoneE164(phoneNumber);
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText || res.statusText };
  }
  return { ok: true };
}

/** Template Meta (nom approuvé côté Business Manager). */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  templateName: string,
  languageCode: string,
  bodyParameters: string[],
): Promise<SendMessageResult> {
  const token = graphToken();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp non configuré (token ou phone_number_id)." };
  }

  const to = phoneE164(phoneNumber);
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components:
          bodyParameters.length > 0
            ? [
                {
                  type: "body",
                  parameters: bodyParameters.map((t) => ({
                    type: "text",
                    text: t,
                  })),
                },
              ]
            : [],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText || res.statusText };
  }
  return { ok: true };
}

/** L’URL du document doit être accessible publiquement (ex. URL signée Supabase). */
export async function sendWhatsAppDocumentMessage(
  phoneNumber: string,
  documentUrl: string,
  filename: string,
  caption?: string,
): Promise<SendMessageResult> {
  const token = graphToken();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp non configuré (token ou phone_number_id)." };
  }

  const to = phoneE164(phoneNumber);
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  const document: Record<string, string> = {
    link: documentUrl,
    filename: filename || "document.pdf",
  };
  if (caption?.trim()) {
    document.caption = caption.trim();
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText || res.statusText };
  }
  return { ok: true };
}
