"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  UserCheck,
  Save,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { SupabaseLeadRow } from "@/lib/supabase-lead-row";
import {
  runQualificationAgent,
  validateQualification,
  saveQualificationFields,
  type QualificationFields,
} from "@/app/(dashboard)/leads/ai-actions";

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; hex: string }> = {
    pending:    { label: "En attente de validation", hex: "#c47c20" },
    validated:  { label: "Qualifiée",                hex: "#2d7a5f" },
    overridden: { label: "Modifiée manuellement",    hex: "#182b35" },
    rejected:   { label: "Rejetée",                  hex: "#a83232" },
  };
  const { label, hex } = cfg[status] ?? { label: status, hex: "#60727c" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: hex,
        background: `${hex}18`,
        border: `1px solid ${hex}30`,
        borderRadius: 4,
        padding: "2px 8px",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "rounded-md border border-border bg-panel-muted px-3 py-2 text-sm text-foreground " +
    "placeholder:text-muted-foreground focus:border-[#182b35] focus:outline-none " +
    "focus:ring-2 focus:ring-[#182b35]/20";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// ─── LeadQualificationWorkspace ───────────────────────────────────────────────

export function LeadQualificationWorkspace({ lead }: { lead: SupabaseLeadRow }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [destination, setDestination] = useState(lead.destination_main ?? "");
  const [dates, setDates] = useState(lead.trip_dates ?? "");
  const [travelers, setTravelers] = useState(lead.travelers ?? "");
  const [budget, setBudget] = useState(lead.budget ?? "");
  const [style, setStyle] = useState(lead.travel_style ?? "");
  const [notes, setNotes] = useState(lead.qualification_notes ?? "");
  const [narrative, setNarrative] = useState(lead.travel_desire_narrative ?? "");

  const [aiRunning, setAiRunning] = useState(false);
  const [saveRunning, setSaveRunning] = useState(false);
  const [validateRunning, setValidateRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(
    lead.ai_qualification_confidence ? Number(lead.ai_qualification_confidence) : null,
  );

  const isValidated = lead.qualification_validation_status === "validated";
  const isManual = lead.manual_takeover;

  async function handleRunAgent() {
    setAiRunning(true);
    setError(null);
    setMsg(null);
    const res = await runQualificationAgent(lead.id);
    setAiRunning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.destination_main) setDestination(res.destination_main);
    if (res.trip_dates) setDates(res.trip_dates);
    if (res.travelers) setTravelers(res.travelers);
    if (res.budget) setBudget(res.budget);
    if (res.travel_style) setStyle(res.travel_style);
    if (res.travel_desire_narrative) setNarrative(res.travel_desire_narrative);
    if (res.ai_qualification_confidence) setConfidence(res.ai_qualification_confidence);
    setMsg("Résultats IA chargés — vérifiez et sauvegardez.");
  }

  async function handleSave() {
    setSaveRunning(true);
    setError(null);
    setMsg(null);
    const fields: QualificationFields = {
      destination_main: destination,
      trip_dates: dates,
      travelers,
      budget,
      travel_style: style,
      travel_desire_narrative: narrative,
      qualification_notes: notes,
    };
    const res = await saveQualificationFields(lead.id, fields);
    setSaveRunning(false);
    if (!res.ok) {
      setError(res.error ?? "Erreur sauvegarde.");
      return;
    }
    setMsg("Sauvegardé.");
    startTransition(() => router.refresh());
  }

  async function handleValidate() {
    setValidateRunning(true);
    setError(null);
    const res = await validateQualification(lead.id);
    setValidateRunning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  const busy = aiRunning || saveRunning || validateRunning;
  const canValidate =
    destination.trim().length > 0 &&
    dates.trim().length > 0 &&
    travelers.trim().length > 0 &&
    budget.trim().length > 0 &&
    narrative.trim().length > 20;

  return (
    <section
      className="rounded-md border bg-panel p-4 sm:p-6"
      style={{ borderColor: "#182b35" }}
    >
      {/* En-tête */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Qualification du besoin
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isManual
              ? "Mode manuel — remplissez directement les champs ci-dessous."
              : "Mode IA — lancez l'agent pour pré-remplir, puis validez."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={lead.qualification_validation_status} />
          {confidence != null && (
            <span className="text-[11px] text-muted-foreground">
              Confiance IA&nbsp;: {Math.round(confidence * 100)}&nbsp;%
            </span>
          )}
        </div>
      </div>

      {/* Alertes */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-sm text-red-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          {msg}
        </div>
      )}

      {/* Grille */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Données structurées */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Données structurées
          </p>
          <FieldRow
            label="Destination principale"
            value={destination}
            onChange={setDestination}
            placeholder="ex : Hoggar / Tamanrasset"
          />
          <FieldRow
            label="Période & durée"
            value={dates}
            onChange={setDates}
            placeholder="ex : Juillet 2026 — 10 à 14 jours"
          />
          <FieldRow
            label="Composition du groupe"
            value={travelers}
            onChange={setTravelers}
            placeholder="ex : 4 personnes — 2 adultes + 2 enfants (9 et 13 ans)"
          />
          <FieldRow
            label="Budget indicatif"
            value={budget}
            onChange={setBudget}
            placeholder="ex : 3 000 – 4 500 EUR total"
          />
          <FieldRow
            label="Style de voyage"
            value={style}
            onChange={setStyle}
            placeholder="ex : aventure douce, authenticité, famille"
          />
          <FieldRow
            label="Notes internes opérateur"
            value={notes}
            onChange={setNotes}
            placeholder="Observations, contexte, points d'attention…"
            multiline
          />
        </div>

        {/* Synthèse envies */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              Synthèse — envies &amp; ressenti voyage
            </p>
            <span className="text-[10px] italic text-muted-foreground">
              Narratif libre · non-déterministe
            </span>
          </div>
          <div
            className="flex flex-1 rounded-md border border-dashed bg-panel-muted/40"
            style={{ borderColor: "#182b35", minHeight: 220 }}
          >
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder={
                "Ce voyageur porte depuis longtemps le rêve du désert vrai…\n\n" +
                "Décrivez ici l'essence de ce qu'il cherche : ses émotions, ses images mentales, " +
                "ce qui compte vraiment pour lui. Pas une liste de critères — un portrait du voyage rêvé."
              }
              className="min-h-[200px] w-full resize-none rounded border-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Générée par l&apos;agent IA ou rédigée librement. Ce n&apos;est pas une liste —
            c&apos;est le ressenti, la promesse implicite du voyage.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
        {!isManual && !isValidated && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRunAgent}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: "#182b35", borderColor: "#182b35", color: "#f3f7fa" }}
          >
            {aiRunning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {aiRunning ? "Agent en cours…" : "Lancer l'agent IA"}
          </button>
        )}

        {!isValidated && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel-muted disabled:opacity-50"
          >
            {saveRunning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {saveRunning ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        )}

        {!isValidated && (
          <button
            type="button"
            disabled={!canValidate || busy}
            onClick={handleValidate}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
            style={
              canValidate
                ? { background: "#2d7a5f", borderColor: "#2d7a5f", color: "#ffffff" }
                : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
            }
          >
            {validateRunning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserCheck className="size-4" aria-hidden />
            )}
            {validateRunning ? "Validation…" : "Valider la qualification"}
            {canValidate && !validateRunning && (
              <ChevronRight className="size-4" aria-hidden />
            )}
          </button>
        )}

        {isValidated && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            Qualification validée — dossier en Assignation agence
          </div>
        )}

        {!canValidate && !isValidated && (
          <p className="text-[11px] text-muted-foreground">
            Complétez destination, dates, groupe, budget et synthèse (min. 20 car.) pour valider.
          </p>
        )}
      </div>
    </section>
  );
}
