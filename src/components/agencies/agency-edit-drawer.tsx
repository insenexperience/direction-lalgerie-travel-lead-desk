"use client";

import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { createPartnerAgency, updateAgency } from "@/app/(dashboard)/agencies/actions";
import type { AgencyListItem } from "@/lib/agencies/types";
import type { PartnerAgencyType } from "@/lib/mock-agencies";

interface AgencyEditDrawerProps {
  open: boolean;
  onClose: () => void;
  agency?: AgencyListItem | null;
  onSuccess?: () => void;
}

const TYPE_OPTIONS: { value: PartnerAgencyType; label: string }[] = [
  { value: "dmc", label: "DMC" },
  { value: "travel_agency", label: "Agence de voyage" },
  { value: "tour_operator", label: "Tour Opérateur" },
  { value: "other", label: "Autre" },
];

const INPUT_CLS = "w-full rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[13px] text-[#0e1a21] placeholder:text-[#9aa7b0] focus:border-[#15323f] focus:outline-none";
const SELECT_CLS = "w-full rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[13px] text-[#0e1a21] focus:border-[#15323f] focus:outline-none";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium text-[#6b7a85]">{children}</label>;
}

const FInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function FInput(props, ref) {
    return <input {...props} ref={ref} className={INPUT_CLS} />;
  }
);
FInput.displayName = "FInput";

export function AgencyEditDrawer({ open, onClose, agency, onSuccess }: AgencyEditDrawerProps) {
  const isEdit = !!agency;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    legal_name: "",
    trade_name: "",
    type: "dmc" as PartnerAgencyType,
    country: "Algérie",
    city: "",
    website: "",
    destinations: "",
    languages: "",
    segments: "",
    sla_quote_days: "4",
    internal_notes: "",
    contact_name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (open) {
      setError(null);
      if (agency) {
        setForm({
          legal_name: agency.legal_name,
          trade_name: agency.trade_name ?? "",
          type: agency.type,
          country: agency.country,
          city: agency.city,
          website: agency.website ?? "",
          destinations: agency.destinations,
          languages: agency.languages,
          segments: agency.segments,
          sla_quote_days: String(agency.sla_quote_days),
          internal_notes: agency.internal_notes ?? "",
          contact_name: agency.primary_contact_name ?? "",
          email: agency.primary_contact_email ?? "",
          phone: agency.primary_contact_phone ?? "",
        });
      } else {
        setForm({
          legal_name: "", trade_name: "", type: "dmc", country: "Algérie", city: "",
          website: "", destinations: "", languages: "", segments: "", sla_quote_days: "4",
          internal_notes: "", contact_name: "", email: "", phone: "",
        });
      }
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open, agency]);

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let result;
      if (isEdit && agency) {
        result = await updateAgency(agency.id, {
          legal_name: form.legal_name,
          trade_name: form.trade_name || null,
          type: form.type,
          country: form.country,
          city: form.city,
          website: form.website || null,
          destinations: form.destinations,
          languages: form.languages,
          segments: form.segments,
          sla_quote_days: parseInt(form.sla_quote_days) || 4,
          internal_notes: form.internal_notes || null,
        });
      } else {
        result = await createPartnerAgency({
          legalName: form.legal_name,
          tradeName: form.trade_name || undefined,
          type: form.type,
          country: form.country,
          city: form.city,
          website: form.website || undefined,
          destinations: form.destinations,
          languages: form.languages,
          segments: form.segments,
          slaQuoteDays: parseInt(form.sla_quote_days) || 4,
          status: "pending_validation",
          internalNotes: form.internal_notes || undefined,
          contactName: form.contact_name,
          email: form.email,
          phone: form.phone,
        });
      }

      if (result.ok) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-[#e4e8eb] bg-white shadow-xl sm:w-[480px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e4e8eb] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#0e1a21]">
            {isEdit ? `Modifier — ${agency?.trade_name ?? agency?.legal_name}` : "Nouvelle agence"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#6b7a85] hover:bg-[#f6f7f8] hover:text-[#0e1a21] transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form id="agency-form" onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Infos principales */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Informations principales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Raison sociale *</Label>
                <FInput ref={firstInputRef} value={form.legal_name} onChange={set("legal_name")} required placeholder="Sahara Authentique SARL" />
              </div>
              <div>
                <Label>Nom commercial</Label>
                <FInput value={form.trade_name} onChange={set("trade_name")} placeholder="Sahara Authentique" />
              </div>
              <div>
                <Label>Type</Label>
                <select value={form.type} onChange={set("type")} className={SELECT_CLS}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Coordonnées */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Coordonnées</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pays *</Label>
                <FInput value={form.country} onChange={set("country")} required placeholder="Algérie" />
              </div>
              <div>
                <Label>Ville *</Label>
                <FInput value={form.city} onChange={set("city")} required placeholder="Tamanrasset" />
              </div>
              <div className="col-span-2">
                <Label>Site web</Label>
                <FInput value={form.website} onChange={set("website")} type="url" placeholder="https://…" />
              </div>
            </div>
          </section>

          {/* Profil commercial */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Profil commercial</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Destinations</Label>
                <FInput value={form.destinations} onChange={set("destinations")} placeholder="Désert, Sahara, Hoggar…" />
              </div>
              <div>
                <Label>Langues</Label>
                <FInput value={form.languages} onChange={set("languages")} placeholder="FR, EN, AR" />
              </div>
              <div>
                <Label>Segments</Label>
                <FInput value={form.segments} onChange={set("segments")} placeholder="Luxe, Aventure…" />
              </div>
              <div>
                <Label>SLA devis (jours)</Label>
                <FInput value={form.sla_quote_days} onChange={set("sla_quote_days")} type="number" min="1" max="30" />
              </div>
            </div>
          </section>

          {/* Contact principal (création seulement) */}
          {!isEdit && (
            <section>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Contact principal</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Nom complet *</Label>
                  <FInput value={form.contact_name} onChange={set("contact_name")} required placeholder="Kamel Meziane" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <FInput value={form.email} onChange={set("email")} required type="email" placeholder="k.meziane@…" />
                </div>
                <div>
                  <Label>Téléphone *</Label>
                  <FInput value={form.phone} onChange={set("phone")} required placeholder="+213 6 12 34 56 78" />
                </div>
              </div>
            </section>
          )}

          {/* Notes */}
          <section>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#9aa7b0]">Notes internes</p>
            <textarea
              value={form.internal_notes}
              onChange={set("internal_notes")}
              rows={3}
              placeholder="Informations confidentielles, contexte partenariat…"
              className="w-full resize-none rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-2 text-[13px] text-[#0e1a21] placeholder:text-[#9aa7b0] focus:border-[#15323f] focus:outline-none"
            />
          </section>

          {error && (
            <p className="rounded-[6px] border border-[var(--hot-border)] bg-[var(--hot-bg)] px-3 py-2 text-[12px] text-[var(--hot)]">
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#e4e8eb] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#e4e8eb] bg-white px-4 py-2 text-[13px] font-medium text-[#3a4a55] hover:bg-[#f6f7f8] transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="agency-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-[6px] bg-[#15323f] px-4 py-2 text-[13px] font-medium text-[#f3f7fa] hover:bg-[#1a3d4e] disabled:opacity-60 transition-colors"
          >
            {isPending && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {isEdit ? "Enregistrer" : "Créer l'agence"}
          </button>
        </div>
      </div>
    </>
  );
}
