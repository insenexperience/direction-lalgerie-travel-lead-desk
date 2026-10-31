"use client";

import { useMemo, useState } from "react";
import { BASES, type Champ } from "@/lib/radar/bases";
import type { Valeur } from "@/lib/radar/types";
import { Icon } from "@/components/bo3/ui";
import { useRadar } from "./contexte";

/** Saisie d'une propriété Notion selon son type. Les relations se choisissent parmi les fiches du radar. */
export function SaisieChamp({ f, v, onChange, id }: { f: Champ; v: Valeur | undefined; onChange: (v: Valeur) => void; id: string }) {
  switch (f.type) {
    case "select":
      return (
        <select id={id} className="inp" value={typeof v === "string" ? v : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Non renseigné</option>
          {(f.opts ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "multi": {
      const sel = Array.isArray(v) ? v : [];
      return (
        <div className="rd-multi" role="group" aria-labelledby={`${id}-l`}>
          {(f.opts ?? []).map((o) => {
            const on = sel.includes(o);
            return (
              <button key={o} type="button" className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? sel.filter((x) => x !== o) : [...sel, o])}>
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case "number":
      return <input id={id} className="inp" type="number" min={0} max={10} step={1} value={typeof v === "number" ? v : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
    case "date":
      return <input id={id} className="inp" type="date" value={typeof v === "string" ? v.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return (
        <label className="rd-check">
          <input id={id} type="checkbox" checked={!!v} onChange={(e) => onChange(e.target.checked)} /> {v ? "Oui" : "Non"}
        </label>
      );
    case "url":
      return <input id={id} className="inp" type="url" inputMode="url" placeholder="https://" value={typeof v === "string" ? v : ""} onChange={(e) => onChange(e.target.value)} />;
    case "relation":
      return <SaisieRelation f={f} v={Array.isArray(v) ? v : []} onChange={onChange} id={id} />;
    case "created":
      return null;
    default:
      return f.long
        ? <textarea id={id} className="inp" rows={3} value={typeof v === "string" ? v : ""} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} className="inp" value={typeof v === "string" ? v : ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function SaisieRelation({ f, v, onChange, id }: { f: Champ; v: string[]; onChange: (v: Valeur) => void; id: string }) {
  const { bases, noms } = useRadar();
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    if (!f.cible || !q.trim()) return [];
    const n = q.trim().toLowerCase();
    return bases[f.cible].filter((r) => !v.includes(r.id) && r.titre.toLowerCase().includes(n)).slice(0, 8);
  }, [bases, f.cible, q, v]);
  if (!f.cible) return <div className="mt">Lien vers une base hors radar : à modifier dans Notion.</div>;
  return (
    <div className="rd-rel">
      {v.length > 0 && (
        <div className="rd-multi">
          {v.map((x) => (
            <span key={x} className="tag">
              {noms[x] ?? "Fiche hors radar"}
              <button type="button" className="rd-x" aria-label={`Retirer ${noms[x] ?? "ce lien"}`} onClick={() => onChange(v.filter((y) => y !== x))}><Icon n="x" s={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="rd-rel__in">
        <input id={id} className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Lier ${BASES[f.cible].unite}…`} autoComplete="off" />
        {options.length > 0 && (
          <div className="rd-rel__list" role="listbox">
            {options.map((r) => (
              <button key={r.id} type="button" role="option" aria-selected={false} onClick={() => { onChange([...v, r.id]); setQ(""); }}>
                {r.titre} <span className="mt">{r.statut}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
