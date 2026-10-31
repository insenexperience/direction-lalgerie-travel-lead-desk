"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/bo3/ui";
import { BASES, lienNotion, NOTION_METHODE_PAGE, ORDRE, type BaseKey } from "@/lib/radar/bases";
import { actives } from "@/lib/radar/format";
import { CreerFiche } from "./creer";
import { useRadar } from "./contexte";

export function EnteteRadar({ eyebrow, titre, sub, base, notion, extra }: { eyebrow: string; titre: string; sub: ReactNode; base?: BaseKey; notion: string; extra?: ReactNode }) {
  const [creer, setCreer] = useState(false);
  return (
    <>
      <div className="hdr">
        <div><div className="eyebrow">{eyebrow}</div><h1 className="t">{titre}</h1><div className="sub">{sub}</div></div>
        <div className="row wrap">
          {extra}
          <a className="btn s" href={lienNotion(NOTION_METHODE_PAGE)} target="_blank" rel="noopener noreferrer">Méthode</a>
          <a className="btn s" href={notion} target="_blank" rel="noopener noreferrer"><Icon n="link" s={12} /> Notion</a>
          <button className="btn p" onClick={() => setCreer(true)}><Icon n="plus" s={12} /> Nouvelle fiche</button>
        </div>
      </div>
      {creer && <CreerFiche base={base} onClose={() => setCreer(false)} />}
    </>
  );
}

export function NavRadar({ actif }: { actif: BaseKey | "accueil" }) {
  const { bases } = useRadar();
  return (
    <nav className="seg rd-nav" aria-label="Bases du radar">
      <Link href="/radar" className={actif === "accueil" ? "on" : ""} aria-current={actif === "accueil" ? "page" : undefined}>Vue d&apos;ensemble</Link>
      {ORDRE.map((k) => (
        <Link key={k} href={`/radar/${k}`} className={actif === k ? "on" : ""} aria-current={actif === k ? "page" : undefined}>
          {BASES[k].label}<b>{actives(BASES[k], bases[k]).length}</b>
        </Link>
      ))}
    </nav>
  );
}
