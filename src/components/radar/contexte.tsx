"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BASES, ORDRE, type BaseKey } from "@/lib/radar/bases";
import { joursAvant, relatif } from "@/lib/radar/format";
import type { DonneesRadar, Fiche } from "@/lib/radar/types";

/**
 * État partagé du module Radar : les données lues dans Notion (chargées par le layout),
 * les écritures locales en attente de relecture, la fiche ouverte et ce que regarde la personne (pour l'agent).
 */

/** Une écriture reste affichée localement le temps que le cache Notion du serveur la relise. */
const DUREE_LOCALE = 120_000;

type Locale = { f: Fiche; at: number };

type Ctx = {
  donnees: DonneesRadar;
  bases: Record<BaseKey, Fiche[]>;
  noms: Record<string, string>;
  trouver: (id: string) => Fiche | null;
  noter: (f: Fiche) => void;
  ajouter: (f: Fiche) => void;
  ouverte: string | null;
  ouvrir: (id: string) => void;
  fermer: () => void;
  vue: string;
  setVue: (v: string) => void;
  recharger: () => void;
};

const RadarCtx = createContext<Ctx | null>(null);

export function useRadar(): Ctx {
  const c = useContext(RadarCtx);
  if (!c) throw new Error("useRadar hors du module Radar");
  return c;
}

const VIDE = Object.fromEntries(ORDRE.map((k) => [k, [] as Fiche[]])) as Record<BaseKey, Fiche[]>;

export function RadarProvider({ donnees, children }: { donnees: DonneesRadar; children: ReactNode }) {
  const router = useRouter();
  const [locales, setLocales] = useState<Record<string, Locale>>({});
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [vue, setVue] = useState("Accueil du radar");
  const [horloge, setHorloge] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setHorloge(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const bases = useMemo(() => {
    if (!donnees.ok) return VIDE;
    const vivantes = Object.values(locales).filter((l) => horloge - l.at < DUREE_LOCALE);
    const out = {} as Record<BaseKey, Fiche[]>;
    for (const k of ORDRE) {
      const serveur = donnees.bases[k] ?? [];
      const ids = new Set(serveur.map((r) => r.id));
      const parId = new Map(vivantes.filter((l) => l.f.base === k).map((l) => [l.f.id, l.f]));
      out[k] = [...vivantes.filter((l) => l.f.base === k && !ids.has(l.f.id)).map((l) => l.f), ...serveur.map((r) => parId.get(r.id) ?? r)];
    }
    return out;
  }, [donnees, locales, horloge]);

  const noms = useMemo(() => {
    const n: Record<string, string> = {};
    for (const k of ORDRE) for (const r of bases[k]) n[r.id] = r.titre;
    return n;
  }, [bases]);

  const trouver = useCallback((id: string) => {
    for (const k of ORDRE) { const r = bases[k].find((x) => x.id === id); if (r) return r; }
    return null;
  }, [bases]);

  const noter = useCallback((f: Fiche) => setLocales((l) => ({ ...l, [f.id]: { f, at: Date.now() } })), []);
  const recharger = useCallback(() => router.refresh(), [router]);

  const valeur = useMemo<Ctx>(() => ({
    donnees, bases, noms, trouver, noter, ajouter: noter,
    ouverte, ouvrir: setOuverte, fermer: () => setOuverte(null),
    vue, setVue, recharger,
  }), [donnees, bases, noms, trouver, noter, ouverte, vue, recharger]);

  return <RadarCtx.Provider value={valeur}>{children}</RadarCtx.Provider>;
}

// ---------------------------------------------------------------- petits éléments partagés
export function TagStatut({ f }: { f: Fiche }) {
  const b = BASES[f.base];
  const ton = b.tons[f.statut] ?? "";
  return <span className={`tag ${ton}`}>{f.statut || "Sans statut"}</span>;
}

export function TagEcheance({ iso, avant = "" }: { iso: string; avant?: string }) {
  const d = joursAvant(iso);
  if (d == null) return null;
  const ton = d < 0 ? "red" : d <= 7 ? "amber" : "";
  return <span className={`tag ${ton}`} title={iso}>{avant}{relatif(d)}</span>;
}

export function Note({ v }: { v: unknown }) {
  if (typeof v !== "number") return <span className="mt">·</span>;
  return <span className={`rd-note ${v >= 8 ? "haut" : v >= 6 ? "moyen" : ""}`}>{v}</span>;
}

export async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const z = document.createElement("textarea");
    z.value = texte;
    z.style.position = "fixed";
    z.style.opacity = "0";
    document.body.appendChild(z);
    z.select();
    const ok = document.execCommand("copy");
    z.remove();
    return ok;
  }
}
