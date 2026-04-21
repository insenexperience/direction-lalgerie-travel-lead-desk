"use client";

import Link from "next/link";
import { ArrowLeft, UserCheck, UserX, Mail, Phone, Tag, Briefcase } from "lucide-react";
import type { ContactRow, SourceLeadRow, ActivityRow } from "@/app/(dashboard)/contacts/[id]/page";

type ContactDetailProps = {
  contact: ContactRow;
  activities: ActivityRow[];
  sourceLead: SourceLeadRow | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  lead_received: "Lead reçu",
  welcome_email_sent: "Email de bienvenue envoyé",
  preferred_channel_detected: "Canal préféré détecté",
  qualification_completed: "Qualification complète",
  brief_generated: "Brief généré",
  brief_edited: "Brief édité",
  agency_consultation_sent: "Consultation agence envoyée",
  brief_sent_to_agency: "Brief envoyé à l'agence",
  agency_proposal_received: "Proposition agence reçue",
  agency_proposal_declined: "Proposition agence refusée",
  agency_selected: "Agence sélectionnée",
  quote_sent_to_traveler: "Devis envoyé au voyageur",
  step_unlocked: "Étape déverrouillée",
  auto_round_robin_allocation: "Opérateur auto-alloué (round-robin)",
  lead_reset: "Lead remis à zéro",
  contact_promoted_traveler: "Contact promu Voyageur",
  contact_promoted_seeker: "Contact promu Prospect",
};

function activityLabel(kind: string): string {
  return ACTIVITY_LABELS[kind] ?? kind.replace(/_/g, " ");
}

function dateFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function snap(snapshot: Record<string, unknown> | null, key: string): string | null {
  if (!snapshot) return null;
  const v = snapshot[key];
  return typeof v === "string" && v ? v : null;
}

export function ContactDetail({ contact, activities, sourceLead }: ContactDetailProps) {
  const isTraveler = contact.type === "traveler";

  // Projet source : priorité snapshot (conservé même si lead supprimé) → lead live
  const ref       = snap(contact.project_snapshot, "reference") ?? sourceLead?.reference ?? null;
  const summary   = snap(contact.project_snapshot, "trip_summary") ?? sourceLead?.trip_summary ?? null;
  const style     = snap(contact.project_snapshot, "travel_style") ?? sourceLead?.travel_style ?? null;
  const travelers = snap(contact.project_snapshot, "travelers") ?? sourceLead?.travelers ?? null;
  const budget    = snap(contact.project_snapshot, "budget") ?? sourceLead?.budget ?? null;
  const dates     = snap(contact.project_snapshot, "trip_dates") ?? sourceLead?.trip_dates ?? null;
  const leadId    = contact.source_lead_id;

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

      {/* ── Bloc 1 — Identité ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#e8f0f5] text-xl font-bold text-[#15323f]">
            {contact.full_name.slice(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{contact.full_name}</h1>
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  isTraveler
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700",
                ].join(" ")}
              >
                {isTraveler ? <UserCheck className="size-3" aria-hidden /> : <UserX className="size-3" aria-hidden />}
                {isTraveler ? "Voyageur" : "Prospect perdu"}
              </span>
            </div>

            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              {contact.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <a href={`mailto:${contact.email}`} className="hover:text-foreground">{contact.email}</a>
                </span>
              ) : null}
              {(contact.phone || contact.whatsapp_phone_number) ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {contact.phone ?? contact.whatsapp_phone_number}
                  {!contact.phone && contact.whatsapp_phone_number ? " (WhatsApp)" : ""}
                </span>
              ) : null}
            </div>

            {(contact.tags ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Tag className="size-3.5 text-muted-foreground" aria-hidden />
                {(contact.tags ?? []).map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-panel-muted px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Premier contact</p>
            <p className="mt-1 text-foreground">{dateFr(contact.first_seen_at)}</p>
          </div>
          {isTraveler && contact.won_at ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Voyage validé</p>
              <p className="mt-1 text-foreground">{dateFr(contact.won_at)}</p>
            </div>
          ) : null}
          {!isTraveler && contact.lost_at ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date perdu</p>
              <p className="mt-1 text-foreground">{dateFr(contact.lost_at)}</p>
            </div>
          ) : null}
          {!isTraveler && contact.lost_reason ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Motif</p>
              <p className="mt-1 text-foreground">{contact.lost_reason}</p>
            </div>
          ) : null}
          {isTraveler && contact.traveler_notes ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes voyageur</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{contact.traveler_notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Bloc 2 — Projet source ─────────────────────────────────────── */}
      {(ref || summary || leadId) ? (
        <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="size-4 text-[#15323f]" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">
              Projet voyage associé
              {isTraveler
                ? <span className="ml-2 text-[11px] font-medium text-emerald-700">Gagné</span>
                : <span className="ml-2 text-[11px] font-medium text-red-600">Perdu</span>}
            </h2>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {ref ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Référence</dt>
                <dd className="mt-1 font-mono text-xs text-foreground">{ref}</dd>
              </div>
            ) : null}
            {dates ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dates</dt>
                <dd className="mt-1 text-foreground">{dates}</dd>
              </div>
            ) : null}
            {budget ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Budget</dt>
                <dd className="mt-1 text-foreground">{budget}</dd>
              </div>
            ) : null}
            {travelers ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Voyageurs</dt>
                <dd className="mt-1 text-foreground">{travelers}</dd>
              </div>
            ) : null}
            {style ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Style</dt>
                <dd className="mt-1 text-foreground">{style}</dd>
              </div>
            ) : null}
            {summary ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Résumé</dt>
                <dd className="mt-1 text-foreground">{summary}</dd>
              </div>
            ) : null}
          </dl>

          {leadId ? (
            <div className="mt-4 border-t border-border pt-3">
              <Link
                href={`/leads/${leadId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15323f] hover:underline"
              >
                Voir la fiche lead →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Bloc 3 — Timeline ──────────────────────────────────────────── */}
      {activities.length > 0 ? (
        <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Historique du dossier</h2>
          <ol className="mt-4 space-y-4">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3">
                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#15323f]" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{activityLabel(a.kind)}</p>
                  {a.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{a.detail}</p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
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
