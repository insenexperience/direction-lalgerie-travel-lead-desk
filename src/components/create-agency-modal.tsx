"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import type { CreatePartnerAgencyInput } from "@/lib/mock-agencies";
import {
  partnerAgencyStatusLabelFr,
  partnerAgencyTypeLabelFr,
} from "@/lib/mock-agencies";
import type { PartnerAgencyStatus, PartnerAgencyType } from "@/lib/mock-agencies";

type CreateAgencyModalProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Succès : fermeture + reset du formulaire.
   * Échec : afficher `error` dans le dialogue.
   */
  onCreate: (
    input: CreatePartnerAgencyInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Texte d’aide sous le titre du dialogue. */
  dataSource?: "demo" | "supabase";
};

const types: PartnerAgencyType[] = ["dmc", "travel_agency", "tour_operator", "other"];
const statuses: PartnerAgencyStatus[] = ["active", "pending_validation", "suspended"];

export function CreateAgencyModal({
  open,
  onClose,
  onCreate,
  dataSource = "demo",
}: CreateAgencyModalProps) {
  const formId = useId();
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [type, setType] = useState<PartnerAgencyType>("dmc");
  const [country, setCountry] = useState("Algérie");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [destinations, setDestinations] = useState("");
  const [languages, setLanguages] = useState("");
  const [segments, setSegments] = useState("");
  const [slaQuoteDays, setSlaQuoteDays] = useState(4);
  const [status, setStatus] = useState<PartnerAgencyStatus>("pending_validation");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSubmitError(null);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!legalName.trim() || !city.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await onCreate({
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        type,
        country: country.trim(),
        city: city.trim(),
        website: website.trim() || undefined,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        destinations: destinations.trim(),
        languages: languages.trim(),
        segments: segments.trim(),
        slaQuoteDays: Math.max(1, Math.min(30, slaQuoteDays)),
        status,
        internalNotes: internalNotes.trim() || undefined,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
    } finally {
      setSubmitting(false);
    }
    onClose();
    setLegalName("");
    setTradeName("");
    setType("dmc");
    setCountry("Algérie");
    setCity("");
    setWebsite("");
    setContactName("");
    setEmail("");
    setPhone("");
    setDestinations("");
    setLanguages("");
    setSegments("");
    setSlaQuoteDays(4);
    setStatus("pending_validation");
    setInternalNotes("");
    setSubmitError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1419]/55 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="relative z-10 flex max-h-[min(92vh,48rem)] w-full max-w-2xl flex-col rounded-md border border-border bg-panel shadow-lg sm:max-h-[90vh]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <h2 id={`${formId}-title`} className="font-display text-lg font-semibold text-foreground">
              Nouvelle agence partenaire
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dataSource === "supabase"
                ? "Enregistrement dans Supabase — visible sur toutes les fiches leads (assignation)."
                : "Fiche pour l’annuaire interne (démo locale dans ce navigateur)."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground/80 transition-colors hover:bg-panel-muted"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          id={`${formId}-form`}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Raison sociale *
              </span>
              <input
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
                placeholder="SARL / EURL…"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nom commercial
              </span>
              <input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PartnerAgencyType)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {partnerAgencyTypeLabelFr[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Statut
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PartnerAgencyStatus)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {partnerAgencyStatusLabelFr[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pays *
              </span>
              <input
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ville *
              </span>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Site web
              </span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                type="url"
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
                placeholder="https://"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact principal *
              </span>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Délai cible devis (j) *
              </span>
              <input
                required
                type="number"
                min={1}
                max={30}
                value={slaQuoteDays}
                onChange={(e) => setSlaQuoteDays(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email *
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Téléphone *
              </span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Destinations couvertes
              </span>
              <textarea
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Langues
              </span>
              <input
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
                placeholder="FR, EN, AR…"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Segments / produits
              </span>
              <textarea
                value={segments}
                onChange={(e) => setSegments(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes internes
              </span>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full resize-y rounded-md border border-border bg-panel-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-steel/25"
              />
            </label>
          </div>

          {submitError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-border bg-panel-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-panel disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md border border-[#182b35] bg-[#182b35] px-4 py-2 text-sm font-semibold text-[#f3f7fa] transition-colors hover:bg-[#213e4b] disabled:opacity-50"
            >
              {submitting ? "Enregistrement…" : "Enregistrer l’agence"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
