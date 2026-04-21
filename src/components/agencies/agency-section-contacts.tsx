"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, MessageCircle, Star, Trash2, Pencil, Plus } from "lucide-react";
import { addAgencyContact, deleteAgencyContact, setPrimaryAgencyContact } from "@/app/(dashboard)/agencies/contact-actions";
import type { AgencyContact, AgencyDetail } from "@/lib/agencies/types";

const CHANNEL_LABEL: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", phone: "Téléphone" };

function ContactCard({
  contact,
  agencyId,
  onRefresh,
}: {
  contact: AgencyContact;
  agencyId: string;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSetPrimary() {
    startTransition(async () => {
      const r = await setPrimaryAgencyContact(agencyId, contact.id);
      if (r.ok) onRefresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer le contact "${contact.full_name}" ?`)) return;
    startTransition(async () => {
      const r = await deleteAgencyContact(contact.id);
      if (!r.ok) alert(r.error);
      else onRefresh();
    });
  }

  return (
    <div className={`rounded-[8px] border p-4 ${contact.is_primary ? "border-2 border-[#15323f]/25 bg-[#f4f7fa]/50" : "border-[#e4e8eb] bg-white"}`}>
      {contact.is_primary && (
        <span className="mb-2 inline-flex items-center gap-1 rounded-[4px] bg-[#15323f] px-1.5 py-0.5 text-[10px] font-medium text-[#f3f7fa]">
          <Star className="h-2.5 w-2.5" aria-hidden /> Contact principal
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#15323f] text-[12px] font-semibold text-[#f3f7fa]">
            {contact.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#0e1a21]">{contact.full_name}</p>
            {contact.role && <p className="text-[12px] text-[#6b7a85]">{contact.role}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!contact.is_primary && (
            <button
              onClick={handleSetPrimary}
              disabled={isPending}
              title="Définir comme principal"
              className="flex h-7 w-7 items-center justify-center rounded text-[#9aa7b0] hover:bg-[#f6f7f8] hover:text-[#0e1a21] transition-colors disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isPending || contact.is_primary}
            title="Supprimer"
            className="flex h-7 w-7 items-center justify-center rounded text-[#9aa7b0] hover:bg-[#fceee9] hover:text-[#c1411f] transition-colors disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-[12px] text-[#3a4a55] hover:text-[#1e5a8a]">
            <Mail className="h-3.5 w-3.5 text-[#9aa7b0]" aria-hidden />
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-[12px] text-[#3a4a55] hover:text-[#0f6b4b]">
            <Phone className="h-3.5 w-3.5 text-[#9aa7b0]" aria-hidden />
            {contact.phone}
          </a>
        )}
        {contact.whatsapp && (
          <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] text-[#3a4a55] hover:text-[#0f6b4b]">
            <MessageCircle className="h-3.5 w-3.5 text-[#9aa7b0]" aria-hidden />
            WhatsApp
          </a>
        )}
      </div>

      {contact.preferred_channel && (
        <p className="mt-2 text-[11px] text-[#9aa7b0]">
          Canal préféré : <span className="font-medium text-[#6b7a85]">{CHANNEL_LABEL[contact.preferred_channel]}</span>
        </p>
      )}
    </div>
  );
}

interface AgencySectionContactsProps {
  agency: AgencyDetail;
}

export function AgencySectionContacts({ agency }: AgencySectionContactsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [addForm, setAddForm] = useState({ full_name: "", role: "", email: "", phone: "", whatsapp: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    startTransition(async () => {
      const r = await addAgencyContact(agency.id, {
        full_name: addForm.full_name,
        role: addForm.role || null,
        email: addForm.email,
        phone: addForm.phone,
        whatsapp: addForm.whatsapp || null,
      });
      if (r.ok) {
        setShowAddForm(false);
        setAddForm({ full_name: "", role: "", email: "", phone: "", whatsapp: "" });
        forceUpdate((n) => n + 1);
      } else {
        setAddError(r.error);
      }
    });
  }

  const INPUT_CLS = "w-full rounded-[6px] border border-[#e4e8eb] bg-white px-3 py-1.5 text-[13px] text-[#0e1a21] placeholder:text-[#9aa7b0] focus:border-[#15323f] focus:outline-none";

  return (
    <div className="space-y-3">
      {agency.contacts.length === 0 ? (
        <p className="text-[13px] text-[#9aa7b0]">Aucun contact enregistré.</p>
      ) : (
        agency.contacts.map((c) => (
          <ContactCard key={c.id} contact={c} agencyId={agency.id} onRefresh={() => forceUpdate((n) => n + 1)} />
        ))
      )}

      {showAddForm ? (
        <form onSubmit={handleAdd} className="rounded-[8px] border border-[#e4e8eb] bg-white p-4 space-y-3">
          <p className="text-[12px] font-semibold text-[#0e1a21]">Nouveau contact</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input className={INPUT_CLS} required placeholder="Nom complet *" value={addForm.full_name} onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <input className={INPUT_CLS} placeholder="Rôle" value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))} />
            <input className={INPUT_CLS} placeholder="Email" type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={INPUT_CLS} placeholder="Téléphone" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
            <input className={INPUT_CLS} placeholder="WhatsApp (optionnel)" value={addForm.whatsapp} onChange={(e) => setAddForm((f) => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          {addError && <p className="text-[12px] text-[#c1411f]">{addError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[12px] text-[#3a4a55] hover:bg-[#f6f7f8] transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={isPending} className="flex items-center gap-1.5 rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] text-[#f3f7fa] hover:bg-[#1a3d4e] disabled:opacity-60 transition-colors">
              {isPending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Ajouter
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#e4e8eb] py-4 text-[13px] text-[#6b7a85] hover:border-[#15323f]/40 hover:text-[#0e1a21] transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter un contact
        </button>
      )}
    </div>
  );
}
