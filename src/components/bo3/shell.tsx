"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LeadIntakeModal } from "@/components/leads/lead-intake-modal";
import { createClient } from "@/lib/supabase/client";
import { Icon, ToastProvider } from "./ui";

export type PaletteProjet = { id: string; nom: string; ref: string; statut: string; titre: string | null };
export type PaletteAgence = { id: string; n: string; zones: string };

type Props = {
  children: ReactNode;
  counts: { file: number; projets: number; hot: number };
  user: { nom: string; role: string | null; initiales: string };
  projets: PaletteProjet[];
  agences: PaletteAgence[];
  apercu: boolean;
};

/** Écrans refondus (v3). Les autres routes gardent leur mise en page d'avant, dans `.legacy`. */
const V3 = [/^\/inbox$/, /^\/leads$/, /^\/leads\/[^/]+$/, /^\/dashboard$/, /^\/agencies$/];

const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* navigation privée */ } };

export function Bo3Shell({ children, counts, user, projets, agences, apercu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [col, setCol] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [nouveau, setNouveau] = useState(false);

  useEffect(() => { setTheme(lire("bo3_theme") === "dark" ? "dark" : "light"); setCol(lire("bo3_col") === "1"); }, []);
  useEffect(() => { ecrire("bo3_theme", theme); }, [theme]);
  useEffect(() => { ecrire("bo3_col", col ? "1" : "0"); }, [col]);

  const go = useCallback((href: string) => router.push(href), [router]);

  useEffect(() => {
    let g = false;
    let gt: ReturnType<typeof setTimeout>;
    const h = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement).tagName || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setCol((c) => !c); return; }
      if (["input", "textarea", "select"].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "Escape") { setCmd(false); return; }
      const k = e.key.toLowerCase();
      if (k === "g") { g = true; clearTimeout(gt); gt = setTimeout(() => (g = false), 900); return; }
      if (g) { g = false; const dest = { f: "/inbox", p: "/leads", b: "/dashboard", a: "/agencies" }[k]; if (dest) go(dest); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);

  const v3 = V3.some((r) => r.test(pathname));
  const actif = pathname.startsWith("/leads/") ? "/inbox" : pathname;

  return (
    <ToastProvider>
      <div className="bo3" data-theme={theme}>
        <div className={`app ${col ? "col" : ""}`}>
          <Sidebar actif={actif} counts={counts} user={user} col={col} setCol={setCol} />
          <div style={{ minWidth: 0 }}>
            <Topbar
              retour={pathname.startsWith("/leads/") ? () => go("/inbox") : null}
              onCmd={() => setCmd(true)}
              theme={theme}
              setTheme={setTheme}
              onNouveau={() => setNouveau(true)}
              apercu={apercu}
            />
            {v3 ? children : <main className="legacy">{children}</main>}
          </div>
        </div>
        <CommandPalette open={cmd} onClose={() => setCmd(false)} projets={projets} agences={agences} go={go}
          actions={[
            { l: "File de travail", ic: "inbox", k: "G F", f: () => go("/inbox") },
            { l: "Projets", ic: "list", k: "G P", f: () => go("/leads") },
            { l: "Pilotage", ic: "chart", k: "G B", f: () => go("/dashboard") },
            { l: "Agences", ic: "building", k: "G A", f: () => go("/agencies") },
            { l: "Nouveau projet", ic: "plus", f: () => setNouveau(true) },
            { l: col ? "Déplier la barre latérale" : "Replier la barre latérale", ic: "panel", k: "⌘B", f: () => setCol(!col) },
            { l: theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre", ic: theme === "dark" ? "sun" : "moon", f: () => setTheme(theme === "dark" ? "light" : "dark") },
          ]}
        />
        <LeadIntakeModal open={nouveau} onClose={() => setNouveau(false)} onCreated={() => { setNouveau(false); router.refresh(); }} />
      </div>
    </ToastProvider>
  );
}

function Sidebar({ actif, counts, user, col, setCol }: { actif: string; counts: Props["counts"]; user: Props["user"]; col: boolean; setCol: (v: boolean) => void }) {
  const router = useRouter();
  const It = ({ href, ic, l, b, hot, k }: { href: string; ic: string; l: string; b?: number; hot?: boolean; k?: string }) => (
    <Link href={href} className={`sb__it ${actif === href ? "on" : ""}`} title={l} aria-current={actif === href ? "page" : undefined}>
      <Icon n={ic} /><span>{l}</span>{b ? <b className={hot ? "hot" : ""}>{b}</b> : null}{k && <kbd>{k}</kbd>}
    </Link>
  );
  const deconnexion = async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); };
  return (
    <aside className="sb">
      <div className="sb__brand">
        <button className="sb__markbtn" onClick={() => setCol(false)} title="Déplier la barre" aria-label="Déplier la barre">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sb__mark" src="/bo3/mark-da.png" alt="DA" width={34} height={34} />
        </button>
        <div className="sb__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bo3/logo.png" alt="Direction l'Algérie" />
          <div className="sb__sub">Travel Lead Desk</div>
        </div>
      </div>
      <div className="sb__grp">Travail</div>
      <It href="/inbox" ic="inbox" l="File de travail" b={counts.file} hot={counts.hot > 0} k="G F" />
      <It href="/leads" ic="list" l="Projets" b={counts.projets} k="G P" />
      <It href="/dashboard" ic="chart" l="Pilotage" k="G B" />
      <div className="sb__grp">Ressources</div>
      <It href="/agencies" ic="building" l="Agences" k="G A" />
      <It href="/contacts" ic="users" l="Contacts" />
      <It href="/quotes" ic="file" l="Devis" />
      <It href="/users" ic="users" l="Équipe" />
      <It href="/settings" ic="settings" l="Réglages" />
      <div className="sb__foot">
        <span className="av">{user.initiales}</span>
        <div><div style={{ fontWeight: 600 }}>{user.nom}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{user.role === "admin" ? "Opérateur · admin" : "Opérateur"}</div></div>
        <button className="ibtn" title="Se déconnecter" aria-label="Se déconnecter" onClick={deconnexion} style={{ marginLeft: "auto" }}><Icon n="logout" s={15} /></button>
      </div>
      <button className="sb__tgl" onClick={() => setCol(!col)} title={col ? "Déplier la barre (⌘B)" : "Replier la barre (⌘B)"} aria-label={col ? "Déplier la barre" : "Replier la barre"} aria-expanded={!col}>
        <Icon n="panel" s={15} /><span>{col ? "Déplier" : "Replier"}</span><kbd>⌘B</kbd>
      </button>
    </aside>
  );
}

function Topbar({ retour, onCmd, theme, setTheme, onNouveau, apercu }: { retour: (() => void) | null; onCmd: () => void; theme: string; setTheme: (t: "light" | "dark") => void; onNouveau: () => void; apercu: boolean }) {
  return (
    <div className="top">
      {retour ? (
        <button className="btn s sm" onClick={retour}><Icon n="arrowL" s={12} /> File de travail</button>
      ) : (
        <div className="top__search" onClick={onCmd} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onCmd()}>
          <Icon n="search" s={14} /><span>Rechercher ou lancer une action</span><kbd>⌘K</kbd>
        </div>
      )}
      <div className="top__sp" />
      {apercu && <span className="tag amber">Aperçu local · sans session</span>}
      <button className="ibtn" title={theme === "dark" ? "Mode clair" : "Mode sombre"} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon n={theme === "dark" ? "sun" : "moon"} s={15} /></button>
      <button className="btn p sm" onClick={onNouveau}><Icon n="plus" s={12} /> Nouveau projet</button>
    </div>
  );
}

type Action = { l: string; ic: string; k?: string; f: () => void };
function CommandPalette({ open, onClose, projets, agences, go, actions }: { open: boolean; onClose: () => void; projets: PaletteProjet[]; agences: PaletteAgence[]; go: (h: string) => void; actions: Action[] }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => ref.current?.focus(), 30); } }, [open]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const items = useMemo(() => {
    const m = (s: string) => !q || norm(s).includes(norm(q));
    return [
      ...actions.filter((a) => m(a.l)).map((a) => ({ g: "Aller à", l: a.l, s: "", ic: a.ic, k: a.k, f: a.f })),
      ...projets.filter((p) => m(`${p.nom} ${p.ref} ${p.titre ?? ""}`)).map((p) => ({ g: "Projets", l: p.nom, s: `${p.ref} · ${p.statut}${p.titre ? ` · « ${p.titre} »` : ""}`, ic: "file", k: undefined, f: () => go(`/leads/${p.id}`) })),
      ...agences.filter((a) => m(a.n)).map((a) => ({ g: "Agences", l: a.n, s: a.zones, ic: "building", k: undefined, f: () => go(`/agencies/${a.id}`) })),
    ];
  }, [q, actions, projets, agences, go]);
  if (!open) return null;
  const sel = Math.min(i, items.length - 1);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(items.length - 1, sel + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(0, sel - 1)); }
    else if (e.key === "Enter" && items[sel]) { items[sel].f(); onClose(); }
    else if (e.key === "Escape") onClose();
  };
  let lastG: string | null = null;
  return (
    <div className="cmd" onClick={onClose}>
      <div className="cmd__box" role="dialog" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <div className="cmd__in"><Icon n="search" s={16} /><input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Rechercher un projet, une agence, une action…" aria-label="Rechercher" /><kbd>esc</kbd></div>
        <div className="cmd__list">
          {items.length ? items.map((it, k) => {
            const hd = it.g !== lastG;
            lastG = it.g;
            return (
              <div key={k}>
                {hd && <div className="cmd__grp">{it.g}</div>}
                <div className={`cmd__it ${k === sel ? "on" : ""}`} onMouseEnter={() => setI(k)} onClick={() => { it.f(); onClose(); }}>
                  <Icon n={it.ic} s={14} /><span>{it.l}</span>{it.s && <span className="mt">{it.s}</span>}{it.k && <kbd>{it.k}</kbd>}
                </div>
              </div>
            );
          }) : <div className="empty">Aucun résultat</div>}
        </div>
        <div className="cmd__ft"><span><kbd>↑</kbd> <kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span><kbd>G</kbd> puis <kbd>F</kbd> file · <kbd>P</kbd> projets · <kbd>B</kbd> pilotage</span></div>
      </div>
    </div>
  );
}
