"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Clock } from "@/lib/bo3/projet";
import { suggestions } from "@/lib/bo3/projet";
import type { Agence, Projet } from "@/lib/bo3/types";

// ---------------------------------------------------------------- icônes (tracés du prototype)
const P: Record<string, string> = {
  search: "M10 18a8 8 0 1 1 5.3-14 8 8 0 0 1-5.3 14Zm10 3-4.5-4.5", inbox: "M3 12h5l1 3h6l1-3h5M3 12l3-7h12l3 7M3 12v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7",
  list: "M4 6h16M4 12h16M4 18h16", chart: "M4 20V9m6 11V4m6 16v-7M4 20h16", building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0 0h4v-9h-4m-12 9h16M7 8h2m-2 4h2m-2 4h2",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5Zm8-10a3 3 0 1 1 0 6m5 5v-1c0-2-2-3-4-3", file: "M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Zm0 0v7h7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-1-3-2 .3a7 7 0 0 0-1.5-1.5L17 4l-3-1-1 2a7 7 0 0 0-2 0L10 3 7 4l.5 2.8A7 7 0 0 0 6 8.3L3.7 8 3 11l2 1a7 7 0 0 0 0 2l-2 1 1 3 2.3-.3A7 7 0 0 0 7.8 19L7 21l3 1 1-2a7 7 0 0 0 2 0l1 2 3-1-.5-2.8a7 7 0 0 0 1.5-1.5l2.3.3.7-3-2-1a7 7 0 0 0 0-2Z",
  check: "M5 13l4 4L19 7", x: "M6 6l12 12M18 6 6 18", arrowR: "M5 12h14M13 6l6 6-6 6", arrowL: "M19 12H5M11 6l-6 6 6 6", plus: "M12 5v14M5 12h14", send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  wa: "M20 4A10 10 0 0 0 4 17l-1 5 5-1A10 10 0 1 0 20 4Zm-4 12c-1 0-3-1-5-3s-3-4-3-5 .5-2 1.5-2L10 7a3 3 0 0 1 1 2l-1 2c0 1 2 3 3 3l2-1a3 3 0 0 1 2 1l1 1c0 1-1 1.5-2 1.5Z",
  mail: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 0 9 7 9-7", clock: "M12 7v5l3 2m7-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z", bell: "M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 10a2 2 0 0 0 4 0",
  pencil: "M16 3l5 5-12 12H4v-5Z", copy: "M8 8h12v12H8zM4 16V4h12", link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1", alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3v.5",
  chevron: "M6 9l6 6 6-6", sparkles: "M12 3v3m0 12v3M5 12H2m20 0h-3m-2.2-6.8 2.1-2.1M5.1 18.9l2.1-2.1m0-11.6L5.1 3.1m13.8 15.8-2.1-2.1M12 8l1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4", moon: "M21 13A8 8 0 1 1 11 3a6 6 0 0 0 10 10Z", panel: "M3 5h18v14H3zM9 5v14",
  timeline: "M3 6h6M3 12h10M3 18h14M17 4v4m2-2h-4", refresh: "M20 12a8 8 0 1 1-2.3-5.7L20 4v6h-6", logout: "M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7",
};
export function Icon({ n, s = 16, style }: { n: string; s?: number; style?: React.CSSProperties }) {
  const d = P[n];
  if (!d) return null;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {d.split("M").filter(Boolean).map((seg, i) => <path key={i} d={"M" + seg} />)}
    </svg>
  );
}

// ---------------------------------------------------------------- échéances
export function Deadline({ c, small }: { c: Clock; small?: boolean }) {
  return (
    <div className={`dl ${c.state}`}>
      <span className="dl__v">{c.label}</span>
      <div className="dl__bar"><i style={{ width: c.pct + "%" }} /></div>
      {!small && <span className="dl__s">{c.sub}</span>}
    </div>
  );
}
export function Ring({ c, size = 44 }: { c: Clock; size?: number }) {
  const r = (size - 6) / 2, C = 2 * Math.PI * r;
  const pct = Math.min(100, c.pct || 0);
  const v = c.state === "green" ? "✓" : c.rem != null ? (c.rem < 0 ? "!" : Math.round(c.rem) + "h") : "";
  return (
    <div className={`ring ${c.state}`} style={{ width: size, height: size }} title={c.label}>
      <svg width={size} height={size}>
        <circle className="tr" cx={size / 2} cy={size / 2} r={r} />
        <circle className="pr" cx={size / 2} cy={size / 2} r={r} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
      </svg>
      <span className="ring__v">{v}</span>
    </div>
  );
}

// ---------------------------------------------------------------- blocs
export function Card({ t, right, children, cls = "", id }: { t?: ReactNode; right?: ReactNode; children: ReactNode; cls?: string; id?: string }) {
  return (
    <section className={`card ${cls}`} id={id}>
      {(t || right) && <div className="card__hd"><span className="card__t">{t}</span>{right}</div>}
      <div className="card__bd">{children}</div>
    </section>
  );
}

export function Modal({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="ovl" onClick={onClose}>
      <div className="mod" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mod__hd"><div className="mod__t">{title}</div><button className="btn s xs" onClick={onClose} aria-label="Fermer"><Icon n="x" s={12} /></button></div>
        <div className="mod__bd">{children}</div>
        {foot && <div className="mod__ft">{foot}</div>}
      </div>
    </div>
  );
}

export type MenuItem = { l: string; ic: string; f: () => void; d?: boolean } | false | null | undefined;
export function Menu({ items }: { items: MenuItem[] }) {
  const [o, setO] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!o) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setO(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [o]);
  return (
    <div className="menu" ref={ref}>
      <button className="btn s" onClick={() => setO(!o)} aria-expanded={o}>Actions <Icon n="chevron" s={12} /></button>
      {o && (
        <div className="menu__list">
          {items.filter(Boolean).map((it, i) => it && (
            <button key={i} onClick={() => { setO(false); it.f(); }} style={it.d ? { color: "var(--red)" } : {}}><Icon n={it.ic} s={13} /> {it.l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- toast
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 2600); }, []);
  return <ToastCtx.Provider value={toast}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}

/** L'heure avance à l'écran sans recharger : mise à jour chaque minute à partir de l'heure du serveur. */
export function useNow(depart: number) {
  const [now, setNow] = useState(depart);
  useEffect(() => {
    const decalage = depart - Date.now();
    const i = setInterval(() => setNow(Date.now() + decalage), 60_000);
    return () => clearInterval(i);
  }, [depart]);
  return now;
}

// ---------------------------------------------------------------- petits indicateurs
export function Completude({ p }: { p: Projet }) {
  if (!p.trame) return <span className="dots">●○○○ <span className="mt">non qualifié</span></span>;
  const n = 4 - p.manque.length;
  return <span><span className="dots">{"●".repeat(n)}{"○".repeat(4 - n)}</span> <span className="mt">{p.manque.length ? p.manque.join(", ") : "complet"}</span></span>;
}
export function AgencePressentie({ p, agences }: { p: Projet; agences: Agence[] }) {
  if (p.consultations.length) return <span>{p.consultations.map((c) => agences.find((a) => a.id === c.agence)?.n ?? "Agence").join(" + ")}</span>;
  const s = suggestions(p, agences)[0];
  if (!p.trame || !s || !s.jours) return <span className="mt">à déterminer</span>;
  return <span>{s.a.n} <span className="mt">{s.jours} j / {s.total}</span></span>;
}
