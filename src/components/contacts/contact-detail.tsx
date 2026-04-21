"use client";

import Link from "next/link";
import { ArrowLeft, UserCheck, UserX, Mail, Phone, Tag } from "lucide-react";

type ContactRow = {
  id: string;
  type: "traveler" | "seeker";
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone_number: string | null;
  source_lead_id: string | null;
  first_seen_at: string;
  last_interaction_at: string | null;
  won_at: string | null;
  trip_completed_at: string | null;
  traveler_notes: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  kind: string;
  detail: string | null;
  created_at: string;
  actor_id: string | null;
};

type ContactDetailProps = {
  contact: ContactRow;
  activities: ActivityRow[];
  sourceLeadRef: string | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  welcome_email_sent: "Email de bienvenue envoyé",
  preferred_channel_detected: "Canal préféré détecté",
  brief_generated: "Brief généré",
  brief_edited: "Brief édité",
  agency_consultation_sent: "Consultation agence envoyée",
  brief_sent_to_agency: "Brief envoyé à l'agence",
  agency_proposal_received: "Proposition agence reçue",
  agency_proposal_declined: "Proposition agence refusée",
  agency_selected: "Agence sélectionnée",
  step_unlocked: "Étape déverrouillée",
  lead_status_updated: "Statut lead mis à jour",
  referent_assigned: "Opérateur assigné",
};

function activityLabel(kind: string): string {
  return ACTIVITY_LABELS[kind] ?? kind;
}

export function ContactDetail({ contact, activities, sourceLeadRef }: ContactDetailProps) {
  const isTraveler = contact.type === "traveler";

  const dateLabel = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link
        href={`/contacts?type=${contact.type}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Retour aux contacts
      </Link>

      {/* Contact card */}
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          {/* Avatar placeholder */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-panel-muted text-xl font-semibold text-[var(--steel)]">
            {contact.full_name.slice(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{contact.full_name}</h1>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  isTraveler
                    ? "border-[var(--revenue-border)] bg-[var(--revenue-bg)] text-[var(--revenue)]"
                    : "border-red-200 bg-red-50 text-red-700",
                ].join(" ")}
              >
                {isTraveler ? (
                  <UserCheck className="size-3" aria-hidden />
                ) : (
                  <UserX className="size-3" aria-hidden />
                )}
                {isTraveler ? "Voyageur" : "Prospect perdu"}
              </span>
            </div>

            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              {contact.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                    {contact.email}
                  </a>
                </span>
              ) : null}
              {contact.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {contact.phone}
                </span>
              ) : contact.whatsapp_phone_number ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {contact.whatsapp_phone_number} (WhatsApp)
                </span>
              ) : null}
            </div>

            {/* Tags */}
            {(contact.tags ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" aria-hidden />
                {(contact.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-panel-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Premier contact
            </p>
            <p className="mt-1 text-foreground">{dateLabel(contact.first_seen_at)}</p>
          </div>

          {isTraveler && contact.won_at ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Voyage validé
              </p>
              <p className="mt-1 text-foreground">{dateLabel(contact.won_at)}</p>
            </div>
          ) : null}

          {isTraveler && contact.trip_completed_at ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Voyage réalisé
              </p>
              <p className="mt-1 text-foreground">{dateLabel(contact.trip_completed_at)}</p>
            </div>
          ) : null}

          {!isTraveler && contact.lost_at ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Date perdu
              </p>
              <p className="mt-1 text-foreground">{dateLabel(contact.lost_at)}</p>
            </div>
          ) : null}

          {!isTraveler && contact.lost_reason ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Motif
              </p>
              <p className="mt-1 text-foreground">{contact.lost_reason}</p>
            </div>
          ) : null}

          {contact.source_lead_id ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dossier source
              </p>
              <Link
                href={`/leads/${contact.source_lead_id}`}
                className="mt-1 inline-flex items-center gap-1 text-[var(--steel)] hover:underline"
              >
                {sourceLeadRef ?? "Voir le lead"}
              </Link>
            </div>
          ) : null}

          {isTraveler && contact.traveler_notes ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notes voyageur
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{contact.traveler_notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Timeline */}
      {activities.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Historique du dossier</h2>
          <ol className="mt-4 space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--steel)]" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activityLabel(a.kind)}</p>
                  {a.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{a.detail}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
