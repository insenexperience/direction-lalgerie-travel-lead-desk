"use client";

import { useEffect, useMemo, useState } from "react";
import { Scale, UsersRound } from "lucide-react";
import { useAgenciesDemo } from "@/context/agencies-demo-context";
import { useLeadsDemo } from "@/context/leads-demo-context";
import type { AgencyConsultationStatus, MockLead } from "@/lib/mock-leads";
import { agencyConsultationLabelFr } from "@/lib/mock-leads";

const consultationStatuses: AgencyConsultationStatus[] = [
  "invited",
  "pending",
  "quote_received",
  "declined",
  "reminded",
  "expired",
];

type LeadAgencyWorkflowProps = {
  lead: MockLead;
};

export function LeadAgencyWorkflow({ lead }: LeadAgencyWorkflowProps) {
  const { agencies } = useAgenciesDemo();
  const {
    addLeadAgencyConsultation,
    setLeadAgencyLinkStatus,
    setLeadAgencyLinkQuote,
    setRetainedAgencyForLead,
  } = useLeadsDemo();

  const links = lead.agencyLinks ?? [];
  const agencyLinksKey = JSON.stringify(lead.agencyLinks ?? []);
  const [pickAgencyId, setPickAgencyId] = useState("");
  const [retainedPick, setRetainedPick] = useState<string>(
    lead.retainedAgencyId ?? "",
  );
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setRetainedPick(lead.retainedAgencyId ?? "");
  }, [lead.id, lead.retainedAgencyId]);

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const row of lead.agencyLinks ?? []) {
      m[row.id] = row.quoteSummary ?? "";
    }
    setQuoteDrafts(m);
  }, [lead.id, agencyLinksKey, lead.agencyLinks]);

  const availableToAdd = useMemo(() => {
    const taken = new Set(links.map((l) => l.agencyId));
    return agencies.filter((a) => !taken.has(a.id));
  }, [agencies, links]);

  const displayName = (agencyId: string) =>
    agencies.find((a) => a.id === agencyId)?.tradeName ??
    agencies.find((a) => a.id === agencyId)?.legalName ??
    agencyId;

  function addConsultation() {
    if (!pickAgencyId) return;
    const a = agencies.find((x) => x.id === pickAgencyId);
    if (!a) return;
    const name = a.tradeName ?? a.legalName;
    addLeadAgencyConsultation(lead.id, { agencyId: a.id, agencyName: name });
    setPickAgencyId("");
  }

  function applyRetained() {
    if (!retainedPick) {
      setRetainedAgencyForLead(lead.id, null, null);
      return;
    }
    const name = displayName(retainedPick);
    setRetainedAgencyForLead(lead.id, retainedPick, name);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <UsersRound className="size-4 text-steel" aria-hidden />
              Agences consultées
            </h3>
            <p className="mt-2 text-sm text-foreground/85">
              Invitez plusieurs partenaires, suivez les statuts puis consolidez les devis avant arbitrage DA.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted-foreground">Ajouter une agence</span>
            <select
              value={pickAgencyId}
              onChange={(e) => setPickAgencyId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-steel/25"
            >
              <option value="">Choisir dans l’annuaire…</option>
              {availableToAdd.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.tradeName ?? a.legalName) + ` — ${a.city}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={addConsultation}
            disabled={!pickAgencyId}
            className="rounded-md border border-border bg-panel-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>

        {links.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-border bg-panel-muted/50 px-3 py-4 text-sm text-muted-foreground">
            Aucune agence sur ce dossier pour l’instant. Ajoutez-en depuis l’annuaire ou créez une fiche dans « Agences ».
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Agence</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Synthèse devis</th>
                  <th className="py-2">Mise à jour</th>
                </tr>
              </thead>
              <tbody>
                {links.map((row) => (
                  <tr key={row.id} className="border-b border-border/80 align-top">
                    <td className="py-3 pr-3 font-semibold text-foreground">{row.agencyName}</td>
                    <td className="py-3 pr-3">
                      <select
                        value={row.status}
                        onChange={(e) =>
                          setLeadAgencyLinkStatus(
                            lead.id,
                            row.id,
                            e.target.value as AgencyConsultationStatus,
                          )
                        }
                        className="w-full min-w-[10rem] rounded-md border border-border bg-panel-muted px-2 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-steel/25"
                      >
                        {consultationStatuses.map((s) => (
                          <option key={s} value={s}>
                            {agencyConsultationLabelFr[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <textarea
                        value={quoteDrafts[row.id] ?? row.quoteSummary ?? ""}
                        onChange={(e) =>
                          setQuoteDrafts((d) => ({ ...d, [row.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Ex. 4 200 € TTC — délai 5 j…"
                        className="w-full min-w-[12rem] resize-y rounded-md border border-border bg-panel-muted px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-steel/25"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLeadAgencyLinkQuote(
                            lead.id,
                            row.id,
                            quoteDrafts[row.id] ?? row.quoteSummary ?? "",
                          )
                        }
                        className="mt-1 text-xs font-semibold text-steel underline-offset-2 hover:underline"
                      >
                        Enregistrer le devis
                      </button>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {row.quoteSummary ? "Devis renseigné" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comparateur rapide
        </h3>
        <p className="mt-2 text-sm text-foreground/85">
          Les lignes avec synthèse devis servent à comparer prix, délais et adéquation avant décision DA.
        </p>
        <ul className="mt-4 space-y-3">
          {links.filter((l) => l.quoteSummary?.trim()).length === 0 ? (
            <li className="rounded-md border border-border bg-panel-muted/60 px-3 py-3 text-sm text-muted-foreground">
              Aucune synthèse devis enregistrée. Saisissez une synthèse dans le tableau ci-dessus.
            </li>
          ) : (
            links
              .filter((l) => l.quoteSummary?.trim())
              .map((l) => (
                <li
                  key={l.id}
                  className="rounded-md border border-border bg-panel-muted/60 px-3 py-3"
                >
                  <p className="text-sm font-semibold text-foreground">{l.agencyName}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">{l.quoteSummary}</p>
                </li>
              ))
          )}
        </ul>
      </section>

      <section className="rounded-md border border-border bg-panel p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Scale className="size-4 text-steel" aria-hidden />
          Arbitrage DA
        </h3>
        <p className="mt-2 text-sm text-foreground/85">
          Après réception des devis (ou arbitrage sur capacité / adéquation), désignez l’agence retenue pour la suite du dossier.
        </p>
        {links.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ajoutez au moins une agence consultée pour activer l’arbitrage.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <fieldset>
              <legend className="sr-only">Agence retenue</legend>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-panel-muted/60 px-3 py-2.5">
                  <input
                    type="radio"
                    name={`retained-${lead.id}`}
                    checked={retainedPick === ""}
                    onChange={() => setRetainedPick("")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Aucune pour l’instant</span>
                    <span className="text-xs text-muted-foreground">Réinitialise la sélection.</span>
                  </span>
                </label>
                {links.map((l) => (
                  <label
                    key={l.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-panel-muted/60 px-3 py-2.5"
                  >
                    <input
                      type="radio"
                      name={`retained-${lead.id}`}
                      checked={retainedPick === l.agencyId}
                      onChange={() => setRetainedPick(l.agencyId)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{l.agencyName}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.quoteSummary ? l.quoteSummary : "Pas encore de synthèse devis"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={applyRetained}
              className="rounded-md border border-[#182b35] bg-[#182b35] px-4 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#213e4b]"
            >
              Enregistrer l’arbitrage
            </button>
            {lead.retainedAgencyId ? (
              <p className="text-xs text-muted-foreground">
                Actuellement retenue :{" "}
                <span className="font-semibold text-foreground">{lead.assignedAgency}</span>
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
