"use client";

import dynamic from "next/dynamic";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { deskScopeForPath, type DeskProjectTab } from "@/lib/assistant/scope";
import { AssistantConnectionProvider } from "@/components/assistant/assistant-connection";
import { DeskToastProvider, useDeskToast } from "@/components/ui/desk-toast";
import "@/styles/desk-assistant.css";
import { createClient } from "@/lib/supabase/client";
import { Icon, ToastProvider } from "./ui";

const AssistantBubble = dynamic(() => import("@/components/assistant/assistant-bubble").then((m) => m.AssistantBubble), { ssr: false });
const LeadIntakeModal = dynamic(() => import("@/components/leads/lead-intake-modal").then((m) => m.LeadIntakeModal), {
  ssr: false,
  loading: () => <div className="desk-opening" role="status">Ouverture du formulaire…</div>,
});

export type PaletteProjet = { id: string; nom: string; ref: string; statut: string; titre: string | null; tab: DeskProjectTab; closed: boolean };
export type PaletteAgence = { id: string; n: string; zones: string };

export type DeskNavigationData = {
  counts: { file: number; projets: number; hot: number } | null;
  projets: PaletteProjet[];
  agences: PaletteAgence[];
  unavailable?: boolean;
};

type Props = {
  children: ReactNode;
  navigation: Promise<DeskNavigationData>;
  user: { nom: string; role: string | null; initiales: string };
  apercu: boolean;
};

/** Écrans refondus (v3). Les autres routes gardent leur mise en page d'avant, dans `.legacy`. */
const V3 = [/^\/inbox$/, /^\/leads$/, /^\/leads\/[^/]+$/, /^\/dashboard$/, /^\/agencies$/, /^\/radar(\/[^/]+)?$/];

const preferenceEvent = "bo3-preference";
const temporaryPreferences = new Map<string, string>();
const lire = (key: string) => {
  try { return temporaryPreferences.get(key) ?? window.localStorage.getItem(key); }
  catch { return null; }
};
const ecrire = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); temporaryPreferences.delete(key); }
  catch { temporaryPreferences.set(key, value); }
  window.dispatchEvent(new Event(preferenceEvent));
};
function subscribePreferences(notify: () => void) {
  window.addEventListener(preferenceEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(preferenceEvent, notify);
    window.removeEventListener("storage", notify);
  };
}
const light = () => "light" as const;
const expanded = () => false;
const lireTheme = () => lire("bo3_theme") === "dark" ? "dark" : "light";
const lireCol = () => lire("bo3_col") === "1";
const setTheme = (theme: "light" | "dark") => ecrire("bo3_theme", theme);
const setCol = (col: boolean) => ecrire("bo3_col", col ? "1" : "0");

export function Bo3Shell({ children, navigation, user, apercu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useSyncExternalStore(subscribePreferences, lireTheme, light);
  const col = useSyncExternalStore(subscribePreferences, lireCol, expanded);
  const [cmd, setCmd] = useState(false);
  const [nouveau, setNouveau] = useState(false);

  const go = useCallback((href: string) => router.push(href), [router]);

  useEffect(() => {
    let g = false;
    let gt: ReturnType<typeof setTimeout>;
    const h = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement).tagName || "").toLowerCase();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((c) => !c); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setCol(!lireCol()); return; }
      if (["input", "textarea", "select"].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "Escape") { setCmd(false); return; }
      const k = e.key.toLowerCase();
      if (k === "g") { g = true; clearTimeout(gt); gt = setTimeout(() => (g = false), 900); return; }
      if (g) { g = false; const dest = { f: "/inbox", p: "/leads", b: "/dashboard", a: "/agencies", r: "/radar" }[k]; if (dest) go(dest); }
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); clearTimeout(gt); };
  }, [go]);

  const v3 = V3.some((r) => r.test(pathname));
  const actif = pathname.startsWith("/leads/") ? "/inbox" : pathname.startsWith("/radar") ? "/radar" : pathname;
  const leadKey = /^\/leads\/([^/]+)(?:\/workflow)?$/.exec(pathname)?.[1];

  return (
    <ToastProvider>
      <div className="bo3" data-theme={theme}>
        <DeskToastProvider>
        <div className={`app ${col ? "col" : ""}`}>
          <Sidebar actif={actif} navigation={navigation} user={user} col={col} setCol={setCol} />
          <div style={{ minWidth: 0 }}>
            <Topbar
              retour={pathname.startsWith("/leads/") ? () => go("/inbox") : null}
              onCmd={() => setCmd(true)}
              theme={theme}
              setTheme={setTheme}
              onNouveau={() => setNouveau(true)}
              apercu={apercu}
            />
            <AssistantConnectionProvider>
              <div className="desk-main">{v3 ? children : <main className="legacy">{children}</main>}</div>
              {!apercu && <Suspense><DeskAssistant navigation={navigation} leadKey={leadKey} pathname={pathname} onNewProject={() => setNouveau(true)} /></Suspense>}
            </AssistantConnectionProvider>
          </div>
        </div>
        {cmd && <CommandPalette onClose={() => setCmd(false)} navigation={navigation} go={go}
          actions={[
            { l: "File de travail", ic: "inbox", k: "G F", f: () => go("/inbox") },
            { l: "Projets", ic: "list", k: "G P", f: () => go("/leads") },
            { l: "Pilotage", ic: "chart", k: "G B", f: () => go("/dashboard") },
            { l: "Agences", ic: "building", k: "G A", f: () => go("/agencies") },
            { l: "Radar · veille et réseau", ic: "radar", k: "G R", f: () => go("/radar") },
            { l: "Nouveau projet", ic: "plus", f: () => setNouveau(true) },
            { l: col ? "Déplier la barre latérale" : "Replier la barre latérale", ic: "panel", k: "⌘B", f: () => setCol(!col) },
            { l: theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre", ic: theme === "dark" ? "sun" : "moon", f: () => setTheme(theme === "dark" ? "light" : "dark") },
          ]}
        />}
        {nouveau && <DeskNewProjectModal onClose={() => setNouveau(false)} />}
        </DeskToastProvider>
      </div>
    </ToastProvider>
  );
}

function DeskNewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useDeskToast();
  return <LeadIntakeModal open onClose={onClose} onCreated={() => {
    onClose(); toast.success("Projet créé."); router.refresh();
  }} />;
}

function DeskAssistant({ navigation, leadKey, pathname, onNewProject }: { navigation: Props["navigation"]; leadKey?: string; pathname: string; onNewProject: () => void }) {
  const { projets, agences } = use(navigation);
  const lead = leadKey ? projets.find(({ id, ref }) => id === leadKey || ref === leadKey) : undefined;
  return <AssistantBubble lead={lead} projects={projets} agencies={agences} surface={deskScopeForPath(pathname)} onNewProject={onNewProject} />;
}

function NavBadge({ navigation, field }: { navigation: Props["navigation"]; field: "file" | "projets" }) {
  const { counts } = use(navigation);
  const value = counts?.[field];
  return value ? <b className={field === "file" && counts?.hot ? "hot" : ""}>{value}</b> : null;
}

function LinkFeedback() {
  const { pending } = useLinkStatus();
  return <span className="desk-link-feedback" data-pending={pending} role="status"><span className="sr-only">{pending ? "Chargement…" : null}</span></span>;
}

function SidebarItem({ actif, href, ic, label, badge, shortcut }: { actif: string; href: string; ic: string; label: string; badge?: ReactNode; shortcut?: string }) {
  return (
    <Link href={href} className={`sb__it ${actif === href ? "on" : ""}`} title={label} aria-current={actif === href ? "page" : undefined}>
      <Icon n={ic} /><span>{label}</span>{badge}{shortcut && <kbd>{shortcut}</kbd>}
      <LinkFeedback />
    </Link>
  );
}

function Sidebar({ actif, navigation, user, col, setCol }: { actif: string; navigation: Props["navigation"]; user: Props["user"]; col: boolean; setCol: (v: boolean) => void }) {
  const router = useRouter();
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
      <SidebarItem actif={actif} href="/inbox" ic="inbox" label="File de travail" shortcut="G F" badge={<Suspense><NavBadge navigation={navigation} field="file" /></Suspense>} />
      <SidebarItem actif={actif} href="/leads" ic="list" label="Projets" shortcut="G P" badge={<Suspense><NavBadge navigation={navigation} field="projets" /></Suspense>} />
      <SidebarItem actif={actif} href="/dashboard" ic="chart" label="Pilotage" shortcut="G B" />
      <div className="sb__grp">Veille</div>
      <SidebarItem actif={actif} href="/radar" ic="radar" label="Radar" shortcut="G R" />
      <div className="sb__grp">Ressources</div>
      <SidebarItem actif={actif} href="/agencies" ic="building" label="Agences" shortcut="G A" />
      <SidebarItem actif={actif} href="/contacts" ic="users" label="Contacts" />
      <SidebarItem actif={actif} href="/quotes" ic="file" label="Devis" />
      <SidebarItem actif={actif} href="/users" ic="users" label="Équipe" />
      <SidebarItem actif={actif} href="/settings" ic="settings" label="Réglages" />
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
type CommandProps = { onClose: () => void; navigation: Props["navigation"]; go: (h: string) => void; actions: Action[] };

function CommandPalette(props: CommandProps) {
  return (
    <div className="cmd" onClick={props.onClose}>
      <div className="cmd__box" role="dialog" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <Suspense fallback={<p role="status" className="desk-loading__inline">Chargement des projets et agences…</p>}>
          <CommandPaletteContent {...props} />
        </Suspense>
      </div>
    </div>
  );
}

function CommandPaletteContent({ onClose, navigation, go, actions }: CommandProps) {
  const { projets, agences, unavailable } = use(navigation);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const items = useMemo(() => {
    const m = (s: string) => !q || norm(s).includes(norm(q));
    return [
      ...actions.filter((a) => m(a.l)).map((a) => ({ g: "Aller à", l: a.l, s: "", ic: a.ic, k: a.k, f: a.f })),
      ...projets.filter((p) => m(`${p.nom} ${p.ref} ${p.titre ?? ""}`)).map((p) => ({ g: "Projets", l: p.nom, s: `${p.ref} · ${p.statut}${p.titre ? ` · « ${p.titre} »` : ""}`, ic: "file", k: undefined, f: () => go(`/leads/${p.id}`) })),
      ...agences.filter((a) => m(a.n)).map((a) => ({ g: "Agences", l: a.n, s: a.zones, ic: "building", k: undefined, f: () => go(`/agencies/${a.id}`) })),
    ];
  }, [q, actions, projets, agences, go]);
  const sel = Math.min(i, items.length - 1);
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI(Math.min(items.length - 1, sel + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(Math.max(0, sel - 1)); }
    else if (e.key === "Enter" && items[sel]) { items[sel].f(); onClose(); }
    else if (e.key === "Escape") onClose();
  };
  let lastG: string | null = null;
  return (
    <>
        <div className="cmd__in"><Icon n="search" s={16} /><input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Rechercher un projet, une agence, une action…" aria-label="Rechercher" /><kbd>esc</kbd></div>
        {unavailable && <p role="status" className="desk-loading__inline">Recherche des projets et agences indisponible. Les raccourcis restent accessibles.</p>}
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
        <div className="cmd__ft"><span><kbd>↑</kbd> <kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span><kbd>G</kbd> puis <kbd>F</kbd> file · <kbd>P</kbd> projets · <kbd>B</kbd> pilotage · <kbd>R</kbd> radar</span></div>
    </>
  );
}
