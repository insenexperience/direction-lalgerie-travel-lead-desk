"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import {
  assignMultipleAgencies,
  markBriefSent,
  markProposalReceived,
  markProposalDeclined,
} from "@/app/(dashboard)/leads/actions";
import type { CoConstructionProposalRow } from "@/lib/co-construction-proposal";
import { coConstructionProposalStatusLabelFr } from "@/lib/co-construction-proposal";
import { useRouter } from "next/navigation";

type AgencyOption = { id: string; label: string };

type AssignMultiplePartnerAgenciesFormProps = {
  leadId: string;
  agencies: AgencyOption[];
  proposals: CoConstructionProposalRow[];
  generatedBrief: string | null;
};

type ProposalReceiveFormState = {
  price: string;
  duration: string;
  summary: string;
};

function StatusBadge({ status }: { status: CoConstructionProposalRow["status"] }) {
  const colors: Record<CoConstructionProposalRow["status"], string> = {
    pending_send: "border-amber-300 bg-amber-50 text-amber-800",
    awaiting_response: "border-blue-200 bg-blue-50 text-blue-800",
    awaiting_agency: "border-blue-200 bg-blue-50 text-blue-800",
    submitted: "border-emerald-300 bg-emerald-50 text-emerald-800",
    approved: "border-[var(--revenue-border)] bg-[var(--revenue-bg)] text-[var(--revenue)]",
    declined: "border-red-200 bg-red-50 text-red-700",
    expired: "border-border bg-panel-muted text-muted-foreground",
  };
  return (
    <span
      className={[
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        colors[status],
      ].join(" ")}
    >
      {coConstructionProposalStatusLabelFr[status]}
    </span>
  );
}

export function AssignMultiplePartnerAgenciesForm({
  leadId,
  agencies,
  proposals,
  generatedBrief,
}: AssignMultiplePartnerAgenciesFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, startAssign] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [briefActionPending, startBriefAction] = useTransition();
  const [briefActionError, setBriefActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [receiveFormId, setReceiveFormId] = useState<string | null>(null);
  const [receiveForm, setReceiveForm] = useState<ProposalReceiveFormState>({
    price: "",
    duration: "",
    summary: "",
  });

  const assignedAgencyIds = new Set(
    proposals.map((p) => p.agency_id).filter(Boolean) as string[],
  );
  const availableAgencies = agencies.filter((a) => !assignedAgencyIds.has(a.id));

  function toggleAgency(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAssign() {
    if (!selected.size) return;
    setAssignError(null);
    startAssign(async () => {
      const res = await assignMultipleAgencies(leadId, Array.from(selected));
      if (!res.ok) {
        setAssignError(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function copyBrief(agencyId: string) {
    if (!generatedBrief) return;
    void navigator.clipboard.writeText(generatedBrief).then(() => {
      setCopiedId(agencyId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleMarkSent(proposalId: string) {
    setBriefActionError(null);
    startBriefAction(async () => {
      const res = await markBriefSent(proposalId, leadId);
      if (!res.ok) setBriefActionError(res.error);
      else router.refresh();
    });
  }

  function handleMarkDeclined(proposalId: string) {
    setBriefActionError(null);
    startBriefAction(async () => {
      const res = await markProposalDeclined(proposalId, leadId);
      if (!res.ok) setBriefActionError(res.error);
      else router.refresh();
    });
  }

  function handleMarkReceived(proposalId: string) {
    setBriefActionError(null);
    startBriefAction(async () => {
      const res = await markProposalReceived(proposalId, leadId, {
        price: receiveForm.price ? Number(receiveForm.price) : null,
        durationDays: receiveForm.duration ? Number(receiveForm.duration) : null,
        summary: receiveForm.summary,
      });
      if (!res.ok) {
        setBriefActionError(res.error);
        return;
      }
      setReceiveFormId(null);
      setReceiveForm({ price: "", duration: "", summary: "" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Existing proposals — brief sending table */}
      {proposals.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Agences consultées ({proposals.length})
          </h4>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-muted/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5">Agence</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proposals.map((p) => {
                  const agencyLabel =
                    agencies.find((a) => a.id === p.agency_id)?.label ?? "Agence inconnue";
                  const isExpanded = receiveFormId === p.id;

                  return (
                    <>
                      <tr key={p.id} className="bg-panel align-top">
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-foreground">{agencyLabel}</span>
                          {p.brief_sent_at ? (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              (brief envoyé le{" "}
                              {new Date(p.brief_sent_at).toLocaleDateString("fr-FR")})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {p.status === "pending_send" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={!generatedBrief || briefActionPending}
                                  onClick={() => copyBrief(p.agency_id ?? "")}
                                  title={!generatedBrief ? "Générez d'abord le brief" : undefined}
                                  className="inline-flex items-center gap-1 rounded border border-border bg-panel-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-panel disabled:opacity-45"
                                >
                                  {copiedId === p.agency_id ? (
                                    <Check className="size-3 text-[var(--revenue)]" aria-hidden />
                                  ) : (
                                    <Copy className="size-3" aria-hidden />
                                  )}
                                  Copier le brief
                                </button>
                                <button
                                  type="button"
                                  disabled={briefActionPending}
                                  onClick={() => handleMarkSent(p.id)}
                                  className="inline-flex items-center gap-1 rounded border border-[var(--info)] bg-[var(--info-bg)] px-2 py-1 text-xs font-medium text-[var(--info)] hover:bg-[var(--info)] hover:text-white disabled:opacity-45"
                                >
                                  J'ai envoyé
                                </button>
                              </>
                            ) : null}

                            {p.status === "awaiting_response" || p.status === "awaiting_agency" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={briefActionPending}
                                  onClick={() => copyBrief(p.agency_id ?? "")}
                                  title={!generatedBrief ? "Brief non généré" : undefined}
                                  className="inline-flex items-center gap-1 rounded border border-border bg-panel-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-panel disabled:opacity-45"
                                >
                                  <Copy className="size-3" aria-hidden />
                                  Relancer
                                </button>
                                <button
                                  type="button"
                                  disabled={briefActionPending}
                                  onClick={() => {
                                    setReceiveFormId(isExpanded ? null : p.id);
                                    setReceiveForm({ price: "", duration: "", summary: "" });
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-45"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="size-3" aria-hidden />
                                  ) : (
                                    <ChevronDown className="size-3" aria-hidden />
                                  )}
                                  Marquer réponse
                                </button>
                                <button
                                  type="button"
                                  disabled={briefActionPending}
                                  onClick={() => handleMarkDeclined(p.id)}
                                  className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-45"
                                >
                                  Refus agence
                                </button>
                              </>
                            ) : null}

                            {p.status === "submitted" ? (
                              <span className="text-xs text-muted-foreground">
                                Proposition reçue — à évaluer en Co-construction
                              </span>
                            ) : null}

                            {p.status === "approved" ? (
                              <span className="text-xs font-semibold text-[var(--revenue)]">
                                ✓ Offre retenue
                              </span>
                            ) : null}

                            {p.status === "declined" ? (
                              <span className="text-xs text-muted-foreground">
                                Refus enregistré
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${p.id}-form`} className="bg-panel-muted/30">
                          <td colSpan={3} className="px-3 pb-3 pt-2">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="block text-xs">
                                <span className="text-muted-foreground">Prix indicatif (€)</span>
                                <input
                                  type="number"
                                  value={receiveForm.price}
                                  onChange={(e) =>
                                    setReceiveForm((s) => ({ ...s, price: e.target.value }))
                                  }
                                  className="mt-1 w-full rounded border border-border bg-panel px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-steel/30"
                                  placeholder="ex. 4500"
                                />
                              </label>
                              <label className="block text-xs">
                                <span className="text-muted-foreground">Durée (jours)</span>
                                <input
                                  type="number"
                                  value={receiveForm.duration}
                                  onChange={(e) =>
                                    setReceiveForm((s) => ({ ...s, duration: e.target.value }))
                                  }
                                  className="mt-1 w-full rounded border border-border bg-panel px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-steel/30"
                                  placeholder="ex. 10"
                                />
                              </label>
                              <label className="block text-xs sm:col-span-3">
                                <span className="text-muted-foreground">Résumé du circuit</span>
                                <textarea
                                  value={receiveForm.summary}
                                  onChange={(e) =>
                                    setReceiveForm((s) => ({ ...s, summary: e.target.value }))
                                  }
                                  rows={3}
                                  className="mt-1 w-full rounded border border-border bg-panel px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-steel/30"
                                  placeholder="Alger — Tipasa — Ghardaïa — Tamanrasset…"
                                />
                              </label>
                            </div>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={briefActionPending}
                                onClick={() => handleMarkReceived(p.id)}
                                className="rounded border border-emerald-400 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
                              >
                                {briefActionPending ? "Enregistrement…" : "Confirmer la réception"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setReceiveFormId(null)}
                                className="rounded border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-panel-muted"
                              >
                                Annuler
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          {briefActionError ? (
            <p className="text-sm text-red-700" role="alert">{briefActionError}</p>
          ) : null}
        </div>
      ) : null}

      {/* Add new agencies */}
      {availableAgencies.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ajouter des agences
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Recommandé : 2–3 agences au total
            </span>
          </div>
          <div className="rounded-md border border-border bg-panel">
            {availableAgencies.map((agency, i) => (
              <label
                key={agency.id}
                className={[
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-panel-muted/50",
                  i > 0 ? "border-t border-border" : "",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selected.has(agency.id)}
                  onChange={() => toggleAgency(agency.id)}
                  className="size-4 rounded border-border accent-[var(--steel)]"
                />
                <span className="text-sm font-medium text-foreground">{agency.label}</span>
              </label>
            ))}
          </div>
          {selected.size > 0 ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={assigning}
                onClick={handleAssign}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--steel)] bg-[var(--steel)] px-3 py-2 text-sm font-semibold text-[var(--steel-ink)] hover:opacity-90 disabled:opacity-45"
              >
                {assigning
                  ? "Enregistrement…"
                  : `Ajouter ${selected.size} agence${selected.size > 1 ? "s" : ""}`}
              </button>
              <span className="text-xs text-muted-foreground">
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
              </span>
            </div>
          ) : null}
          {assignError ? (
            <p className="text-sm text-red-700" role="alert">{assignError}</p>
          ) : null}
        </div>
      ) : null}

      {availableAgencies.length === 0 && proposals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune agence disponible dans le réseau.
        </p>
      ) : null}
    </div>
  );
}
