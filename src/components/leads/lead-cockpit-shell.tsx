"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  MessageSquare,
  Plus,
  Star,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import { displayLeadScore } from "@/lib/lead-score";
import { formatFrDateTimeShort } from "@/lib/format-fr-date-time";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { LeadRail } from "@/components/leads/lead-rail";
import { NextActionCard } from "@/components/leads/next-action-card";
import { LeadScoreModal } from "@/components/leads/lead-score-modal";
import { updateLeadStatus } from "@/app/(dashboard)/leads/actions";

// ─── Commercial grade ───────────────────────────────────────────────────────

function commercialGrade(score: number | null): { grade: string; color: string } {
  if (score == null)  return { grade: "—", color: "text-[#9aa7b0]" };
  if (score >= 90)    return { grade: "A+", color: "text-[#0f6b4b]" };
  if (score >= 75)    return { grade: "A",  color: "text-[#0f6b4b]" };
  if (score >= 60)    return { grade: "B+", color: "text-[#3a4a55]" };
  if (score >= 45)    return { grade: "B",  color: "text-[#a8710b]" };
  return              { grade: "C",  color: "text-[#c1411f]" };
}

// ─── Dots rating ────────────────────────────────────────────────────────────

function DotsRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 rounded-full ${
            i < value ? "bg-[#15323f]" : "bg-[#e4e8eb]"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

// ─── SLA chronology ─────────────────────────────────────────────────────────

function SlaChronology({ lead }: { lead: SupabaseLeadRow }) {
  const slaDeadline = lead.created_at
    ? new Date(new Date(lead.created_at).getTime() + 30 * 60 * 1000)
    : null;
  const now = new Date();
  const slaOverdue = slaDeadline && now > slaDeadline && !lead.referent_assigned_at;
  const slaAtRisk  = slaDeadline && !slaOverdue && (slaDeadline.getTime() - now.getTime()) < 2 * 60 * 60 * 1000 && !lead.referent_assigned_at;

  const steps = [
    { label: "Créé",               value: lead.created_at,          done: true },
    { label: "Référent assigné",   value: lead.referent_assigned_at, done: !!lead.referent_assigned_at },
    { label: "Qualif. terminée",   value: lead.qualification_validated_at, done: !!lead.qualification_validated_at },
    { label: "SLA 1ʳᵉ réponse",   value: slaDeadline?.toISOString() ?? null, done: !!lead.referent_assigned_at, isSla: true },
  ];

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="flex flex-col items-center">
            <span
              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                step.done
                  ? "border-[#15323f] bg-[#15323f]"
                  : step.isSla && slaOverdue
                  ? "border-[#c1411f] bg-[#c1411f]"
                  : step.isSla && slaAtRisk
                  ? "border-[#a8710b] bg-[#a8710b]"
                  : "border-[#e4e8eb] bg-white"
              }`}
              aria-hidden
            />
            {i < steps.length - 1 && (
              <span className="mt-0.5 h-4 w-[2px] shrink-0 bg-[#e4e8eb]" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p
              className={`text-[12px] font-medium ${
                step.isSla && slaOverdue
                  ? "text-[#c1411f]"
                  : step.isSla && slaAtRisk
                  ? "text-[#a8710b]"
                  : step.done
                  ? "text-[#0e1a21]"
                  : "text-[#9aa7b0]"
              }`}
            >
              {step.label}
              {step.isSla && slaOverdue && " — Dépassé"}
              {step.isSla && slaAtRisk  && " — À risque"}
            </p>
            {step.value && (
              <p className="text-[11px] text-[#6b7a85]">
                {formatFrDateTimeShort(step.value)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

function QuickActionBtn({
  children,
  onClick,
  href,
  variant = "default",
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const cls = [
    "flex w-full items-center gap-2 rounded-[6px] border px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-50",
    variant === "danger"
      ? "border-[#f5c9bc] bg-white text-[#c1411f] hover:bg-[#fceee9]"
      : "border-[#e4e8eb] bg-white text-[#3a4a55] hover:border-[#15323f]/20 hover:bg-[#f6f7f8]",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={cls}>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={cls}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

type LeadCockpitShellProps = {
  lead: SupabaseLeadRow;
  referentLabel: string | null;
  qualificationValidatorLabel: string | null;
  isAdmin: boolean;
  currentUserId: string | null;
  children: ReactNode;
  showFicheLink?: boolean;
};

export function LeadCockpitShell({
  lead,
  referentLabel,
  isAdmin,
  currentUserId,
  children,
}: LeadCockpitShellProps) {
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [closingLost, startClosingLost] = useTransition();

  const score = displayLeadScore(lead);
  const { grade, color: gradeColor } = commercialGrade(score);
  const isHot = lead.priority === "high";

  function handleCloseLost() {
    startClosingLost(async () => {
      await updateLeadStatus(lead.id, "lost");
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Link
              href="/leads"
              className="flex items-center gap-1 text-[12px] text-[#6b7a85] transition-colors hover:text-[#15323f]"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Tous les leads
            </Link>
            <span className="text-[#e4e8eb]">·</span>
            <span className="font-mono text-[11px] text-[#9aa7b0]">
              {lead.reference ?? lead.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-[22px] font-semibold leading-tight text-[#0e1a21]">
            {lead.traveler_name || "—"}
          </h1>
          {lead.trip_summary && (
            <p className="mt-1 line-clamp-1 text-[13px] text-[#6b7a85]">{lead.trip_summary}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isHot && (
            <Pill variant="hot" dot>Priorité haute</Pill>
          )}
          <button
            type="button"
            onClick={() => setScoreModalOpen(true)}
            className="flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[12px] font-medium text-[#3a4a55] transition-colors hover:bg-[#f6f7f8]"
          >
            <Star className="h-3.5 w-3.5 text-[#b68d3d]" aria-hidden />
            Score {score ?? "—"}
          </button>
        </div>
      </div>

      {/* ── Rail ── */}
      <div className="overflow-x-auto rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
        <LeadRail status={lead.status} leadId={lead.id} />
      </div>

      {/* ── Next action ── */}
      <NextActionCard lead={lead} currentUserId={currentUserId} />

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_320px] lg:items-start">

        {/* ── COLONNE GAUCHE — CONTEXTE ── */}
        <aside className="flex flex-col gap-4 lg:order-1">
          {/* Voyageur card */}
          <section className="rounded-[8px] border border-[#e4e8eb] bg-white">
            <div className="flex items-center gap-2.5 border-b border-[#e4e8eb] px-4 py-3">
              <Avatar name={lead.traveler_name || "?"} size={34} gold />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#0e1a21]">{lead.traveler_name || "—"}</p>
                <p className="text-[11px] text-[#6b7a85]">{lead.email || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-3">
              {lead.phone    && <InfoField label="Téléphone" value={lead.phone} />}
              {lead.budget   && <InfoField label="Budget" value={lead.budget} mono />}
              {lead.trip_dates && <InfoField label="Dates" value={lead.trip_dates} />}
              {lead.travelers  && <InfoField label="Voyageurs" value={lead.travelers} />}
              {lead.intake_channel && (
                <InfoField
                  label="Canal"
                  value={{ web_form: "Formulaire", whatsapp: "WhatsApp", manual: "Manuel" }[lead.intake_channel] ?? lead.intake_channel}
                />
              )}
              {lead.created_at && <InfoField label="Créé le" value={formatFrDateTimeShort(lead.created_at)} />}
            </div>
          </section>

          {/* Référent card */}
          <section className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Référent</p>
            {referentLabel ? (
              <div className="flex items-center gap-2">
                <Avatar name={referentLabel} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[#0e1a21]">{referentLabel}</p>
                  {lead.referent_assigned_at && (
                    <p className="text-[11px] text-[#9aa7b0]">
                      Depuis {formatFrDateTimeShort(lead.referent_assigned_at)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Pill variant="warn">Non assigné</Pill>
            )}
          </section>
        </aside>

        {/* ── COLONNE CENTRE — TRAVAIL EN COURS ── */}
        <div className="flex flex-col gap-4 lg:order-2">
          {children}
        </div>

        {/* ── COLONNE DROITE — ACTIONS ── */}
        <aside className="flex flex-col gap-4 lg:order-3">
          {/* Scoring commercial */}
          <section className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Scoring commercial</p>
            <div className="mb-3 flex items-center gap-3">
              <span className={`text-[34px] font-bold leading-none ${gradeColor}`}>{grade}</span>
              {score != null && (
                <div className="flex flex-col">
                  <span className="font-mono text-[18px] font-semibold text-[#0e1a21]">{score}/100</span>
                  <span className="text-[11px] text-[#6b7a85]">Score composite</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-[#e4e8eb] pt-3">
              {[
                { label: "Budget", dots: Math.round((score ?? 0) / 20) },
                { label: "Urgence", dots: lead.priority === "high" ? 4 : 2 },
                { label: "Clarté", dots: lead.qualification_validation_status === "validated" ? 4 : lead.qualification_validation_status === "pending" ? 2 : 1 },
                { label: "Conversion", dots: Math.round((score ?? 0) / 25) },
              ].map(({ label, dots }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#6b7a85]">{label}</span>
                  <DotsRating value={Math.min(5, Math.max(0, dots))} />
                </div>
              ))}
            </div>
          </section>

          {/* SLA chronology */}
          <section className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Chronologie SLA</p>
            <SlaChronology lead={lead} />
          </section>

          {/* Quick actions */}
          <section className="rounded-[8px] border border-[#e4e8eb] bg-white px-4 py-3">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Actions rapides</p>
            <div className="flex flex-col gap-2">
              {lead.whatsapp_phone_number && (
                <QuickActionBtn href={`https://wa.me/${lead.whatsapp_phone_number.replace(/\D/g, "")}`}>
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[#25d366]" aria-hidden />
                  WhatsApp voyageur
                </QuickActionBtn>
              )}
              <QuickActionBtn href={`/leads/${lead.id}/quotes/new`}>
                <Plus className="h-3.5 w-3.5 shrink-0 text-[#6b7a85]" aria-hidden />
                Créer un devis
              </QuickActionBtn>
              <QuickActionBtn onClick={() => {}}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#a8710b]" aria-hidden />
                Marquer {lead.priority === "high" ? "priorité normale" : "priorité haute"}
              </QuickActionBtn>
              <QuickActionBtn
                variant="danger"
                onClick={handleCloseLost}
                loading={closingLost}
                disabled={lead.status === "lost"}
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Clôturer — Perdu
              </QuickActionBtn>
            </div>
          </section>
        </aside>
      </div>

      <LeadScoreModal
        open={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        lead={lead}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function InfoField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[#9aa7b0]">{label}</span>
      <span className={`text-[12px] text-[#3a4a55] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
