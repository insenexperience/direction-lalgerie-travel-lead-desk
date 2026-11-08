import { gmailMessageLink, type DeskInboundMail } from "@/lib/email/gmail-intake";

const labels: Record<DeskInboundMail["kind"], string> = {
  agency_proposal: "Proposition à vérifier",
  agency_reply: "Réponse agence",
  traveler_reply: "Réponse voyageur",
};

const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Algiers" });

export function DeskGmailMessages({ messages }: { messages: DeskInboundMail[] }) {
  return <div className="stack">
    {messages.map((mail) => (
      <details key={mail.gmail_id} className="desk-assistant__proposal">
        <summary><b>{labels[mail.kind]}</b> · {mail.subject || "Sans objet"}</summary>
        <div className="mt">{mail.sender} · {time.format(new Date(mail.received_at))}</div>
        {mail.excerpt && <div className="desk-assistant__draft-text">{mail.excerpt}</div>}
        {mail.attachments.length > 0 && <p>Pièces jointes · {mail.attachments.join(", ")}</p>}
        <a href={gmailMessageLink(mail.gmail_thread_id)} target="_blank" rel="noreferrer">Ouvrir le fil dans Gmail</a>
      </details>
    ))}
  </div>;
}
