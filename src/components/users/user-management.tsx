"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Check, Pencil, X, Shield, User, MoreVertical, ExternalLink } from "lucide-react";
import Link from "next/link";
import { updateProfile } from "@/app/(dashboard)/users/actions";

type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "lead_referent";
  email: string;
  avatar_url: string | null;
};

type Props = {
  profiles: Profile[];
  currentUserId: string | null;
  isAdmin: boolean;
  hasAnyAdmin: boolean;
};

function initials(name: string, email: string): string {
  const src = name.trim() || email;
  return src
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function Avatar({ profile }: { profile: Profile }) {
  const letters = initials(profile.full_name, profile.email);
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name || profile.email}
        className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#15323f] to-[#1e5a8a] text-[15px] font-bold text-white shadow ring-2 ring-white">
      {letters || "?"}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#15323f]/20 bg-[#15323f] px-2 py-0.5 text-[10px] font-semibold text-white">
        <Shield className="size-2.5" aria-hidden />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#d1d9e0] bg-[#f6f7f8] px-2 py-0.5 text-[10px] font-semibold text-[#6b7a85]">
      <User className="size-2.5" aria-hidden />
      Opérateur travel desk
    </span>
  );
}

function DropdownMenu({
  isSelf,
  onEdit,
  canEdit,
}: {
  isSelf: boolean;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-[6px] border border-[#e4e8eb] p-1.5 text-[#6b7a85] transition-colors hover:bg-[#f6f7f8] hover:text-[#0e1a21]"
        aria-label="Menu"
      >
        <MoreVertical className="size-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 min-w-[170px] rounded-[8px] border border-[#e4e8eb] bg-white py-1 shadow-lg">
          {canEdit && (
            <button
              type="button"
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[#0e1a21] hover:bg-[#f6f7f8]"
            >
              <Pencil className="size-3.5 text-[#6b7a85]" />
              Modifier la fiche
            </button>
          )}
          {isSelf && (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[#0e1a21] hover:bg-[#f6f7f8]"
            >
              <ExternalLink className="size-3.5 text-[#6b7a85]" />
              Mon profil complet
            </Link>
          )}
          {!isSelf && !canEdit && (
            <p className="px-3 py-2 text-[11px] text-[#9aa7b0]">Lecture seule</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isSelf,
  canEdit,
}: {
  profile: Profile;
  isSelf: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.full_name);
  const [role, setRole] = useState<"admin" | "lead_referent">(profile.role);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    start(async () => {
      const res = await updateProfile(profile.id, {
        full_name: name.trim() || profile.full_name,
        role,
      });
      if (!res.ok) { setError(res.error); return; }
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 800);
    });
  }

  function handleCancel() {
    setName(profile.full_name);
    setRole(profile.role);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="group relative rounded-[10px] border border-[#e4e8eb] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Avatar profile={profile} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">
                  Nom affiché
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[13px] text-[#0e1a21] outline-none focus:border-[#15323f]"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#9aa7b0]">
                  Rôle
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "lead_referent")}
                  className="w-full rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[13px] text-[#0e1a21] outline-none focus:border-[#15323f]"
                >
                  <option value="admin">Admin</option>
                  <option value="lead_referent">Opérateur travel desk</option>
                </select>
              </div>
              {error && <p className="text-[12px] text-[#c1411f]" role="alert">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#15323f] bg-[#15323f] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {saved && <Check className="size-3.5" />}
                  {pending ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e4e8eb] px-3 py-1.5 text-[12px] font-medium text-[#6b7a85] hover:bg-[#f6f7f8]"
                >
                  <X className="size-3.5" />
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-[14px] font-semibold text-[#0e1a21]">
                      {profile.full_name || <span className="italic text-[#9aa7b0]">Sans nom</span>}
                    </p>
                    {isSelf && (
                      <span className="rounded-full border border-[#1e5a8a]/20 bg-[#e8f0f9] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e5a8a]">
                        Vous
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#9aa7b0]">{profile.email}</p>
                </div>
                <DropdownMenu isSelf={isSelf} onEdit={() => setEditing(true)} canEdit={canEdit} />
              </div>
              <div className="mt-3">
                <RoleBadge role={profile.role} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function UserManagement({ profiles, currentUserId, isAdmin, hasAnyAdmin }: Props) {
  return (
    <div className="space-y-4">
      {!hasAnyAdmin && (
        <div className="rounded-[8px] border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-amber-900">Aucun administrateur configuré</p>
          <p className="mt-0.5 text-[12px] text-amber-800">
            Cliquez sur <strong>⋮ → Modifier la fiche</strong> sur votre profil et sélectionnez le rôle <strong>Admin</strong>.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            isSelf={p.id === currentUserId}
            canEdit={isAdmin || (!hasAnyAdmin && p.id === currentUserId)}
          />
        ))}
      </div>

      {profiles.length === 0 && (
        <p className="py-10 text-center text-[13px] text-[#9aa7b0]">Aucun profil trouvé.</p>
      )}
    </div>
  );
}
