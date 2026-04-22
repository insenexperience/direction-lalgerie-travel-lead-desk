"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, LogOut, Camera, CheckCircle, AlertCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, uploadAvatar } from "@/app/(dashboard)/profile/actions";
import { leadStatusLabelFr } from "@/lib/mock-leads";

type LeadRow = {
  id: string;
  reference: string | null;
  traveler_name: string | null;
  status: string;
  created_at: string;
};

type Props = {
  userId: string;
  userEmail: string;
  fullName: string | null;
  role: string | null;
  avatarUrl: string | null;
  bio: string;
  activeLeads: LeadRow[];
  closedLeads: LeadRow[];
};

function dateFr(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(status: string): string {
  return (leadStatusLabelFr as Record<string, string>)[status] ?? status;
}

export function ProfilePageInner({ userId, userEmail, fullName, role, avatarUrl, bio, activeLeads, closedLeads }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [currentBio, setCurrentBio] = useState(bio);
  const [bioSaved, setBioSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleSaveBio() {
    setError(null);
    setBioSaved(false);
    startTransition(async () => {
      const result = await updateProfile({ bio: currentBio });
      if (result.ok) {
        setBioSaved(true);
        setTimeout(() => setBioSaved(false), 2500);
      } else {
        setError(result.error);
      }
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.append("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result.ok && result.url) {
        setCurrentAvatarUrl(result.url);
      } else if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Mon profil</h1>

      {/* ── Infos ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt={fullName ?? userEmail} className="size-11 rounded-full object-cover" />
            ) : (
              <Avatar name={fullName ?? userEmail} size={44} />
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-[#15323f] text-white shadow hover:opacity-90 disabled:opacity-50"
              aria-label="Changer l'avatar"
            >
              <Camera className="size-3.5" aria-hidden />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-foreground">{fullName ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
            {role && (
              <span className="mt-1 inline-block rounded-full border border-border bg-panel-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {role === "admin" ? "Administrateur" : "Référent lead"}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="mt-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Bio
          </label>
          <textarea
            value={currentBio}
            onChange={(e) => setCurrentBio(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-panel-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#15323f]/30 resize-none"
            placeholder="Quelques mots sur vous…"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveBio}
              disabled={isPending}
              className="rounded-[6px] bg-[#15323f] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            {bioSaved && (
              <span className="flex items-center gap-1 text-[12px] text-emerald-700">
                <CheckCircle className="size-3.5" /> Sauvegardé
              </span>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </section>

      {/* ── Mon pipeline ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Mon pipeline</h2>
        {activeLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dossier actif.</p>
        ) : (
          <ul className="space-y-2">
            {activeLeads.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-panel-muted px-3 py-2.5 text-sm transition-colors hover:border-[#15323f]/30 hover:bg-[#eef3f6]"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-foreground truncate block">
                      {lead.traveler_name ?? "—"}
                    </span>
                    {lead.reference && (
                      <span className="text-[11px] font-mono text-muted-foreground">{lead.reference}</span>
                    )}
                  </div>
                  <span className="ml-3 shrink-0 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                    {statusLabel(lead.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Mon historique ───────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Mon historique</h2>
        {closedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dossier terminé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4">Voyageur</th>
                  <th className="pb-2 pr-4">Référence</th>
                  <th className="pb-2 pr-4">Résultat</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {closedLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
                        {lead.traveler_name ?? "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono text-[11px] text-muted-foreground">
                      {lead.reference ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          lead.status === "won"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        {lead.status === "won" ? "Gagné" : "Perdu"}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{dateFr(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Déconnexion ──────────────────────────────────────────── */}
      <div className="flex justify-end pb-4">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-[6px] border border-red-200 bg-white px-3 py-1.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="size-3.5" aria-hidden />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
