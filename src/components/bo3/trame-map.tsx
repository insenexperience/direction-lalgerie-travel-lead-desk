"use client";

import { DZ_PATH, LIEUX, ZONES } from "@/lib/bo3/geo";
import { zonesJours } from "@/lib/bo3/projet";
import type { Trame } from "@/lib/bo3/types";

type Item = { id: string; p: (typeof LIEUX)[string] };
type Label = Item & { left: boolean; lx: number; ly: number };

/** Carte du trajet : lieux dans l'ordre des jours, libellés rangés pour ne jamais couvrir un point. */
export function TrameMap({ trame }: { trame: Trame }) {
  const seq: string[] = [];
  trame.jours.forEach((j) => j.lieux.forEach((id) => { if (LIEUX[id] && seq[seq.length - 1] !== id) seq.push(id); }));
  if (!seq.length) return <div className="map"><div className="empty">Aucun lieu placé sur la carte.</div></div>;
  const days: Record<string, number[]> = {};
  trame.jours.forEach((j) => j.lieux.forEach((id) => { (days[id] = days[id] || []).push(j.n); }));
  const pts = seq.map((id) => LIEUX[id]);
  const uniq = [...new Set(seq)];
  const dayLabel = (id: string) => {
    const d = [...new Set(days[id])];
    const g: string[] = [];
    let s = d[0], e = d[0];
    for (let i = 1; i <= d.length; i++) {
      if (d[i] === e + 1) e = d[i];
      else { g.push(s === e ? "J" + s : "J" + s + "–" + e); s = e = d[i]; }
    }
    return g.join(", ");
  };
  const STEP = 21;
  const items: Item[] = uniq.map((id) => ({ id, p: LIEUX[id] })).sort((a, b) => a.p.y - b.p.y);
  const clusters: { items: Item[]; cx: number; cy: number }[] = [];
  items.forEach((it) => {
    const c = clusters.find((c) => Math.abs(c.cy - it.p.y) < 60 && Math.abs(c.cx - it.p.x) < 70);
    if (c) { c.items.push(it); c.cx = (c.cx * (c.items.length - 1) + it.p.x) / c.items.length; c.cy = (c.cy * (c.items.length - 1) + it.p.y) / c.items.length; }
    else clusters.push({ items: [it], cx: it.p.x, cy: it.p.y });
  });
  const labels: Label[] = [];
  const estW = (it: Item) => (it.p.nom.length + 8) * 7;
  clusters.forEach((c) => {
    const xs = c.items.map((i) => i.p.x);
    const others = items.filter((i) => !c.items.includes(i));
    const place = (left: boolean) => {
      const lx = left ? Math.min(...xs) - 14 : Math.max(...xs) + 14;
      const y0 = Math.max(c.items[0].p.y - ((c.items.length - 1) * STEP) / 2 + 4, 34);
      const h = c.items.length * STEP;
      const w = Math.max(...c.items.map(estW));
      const box = { x: left ? lx - w : lx, y: y0 - 14, w, h };
      const hits = others.filter((o) => o.p.x > box.x - 8 && o.p.x < box.x + box.w + 8 && o.p.y > box.y - 8 && o.p.y < box.y + box.h + 8).length;
      return { left, lx, y0, hits, off: left ? lx - w < 0 : lx + w > 620 };
    };
    let pl = place(c.cx > 480);
    if (pl.hits || pl.off) { const alt = place(!pl.left); if (alt.hits + (alt.off ? 9 : 0) < pl.hits + (pl.off ? 9 : 0)) pl = alt; }
    let y = pl.y0;
    c.items.forEach((it) => { labels.push({ ...it, left: pl.left, lx: pl.lx, ly: y }); y += STEP; });
  });
  labels.sort((a, b) => a.ly - b.ly);
  const last = { l: -99, r: -99 };
  labels.forEach((l) => { const k = l.left ? "l" : "r"; if (l.ly - last[k] < STEP) l.ly = last[k] + STEP; last[k] = l.ly; });
  const zones = Object.keys(zonesJours(trame)).map((z) => ZONES[z as keyof typeof ZONES]).join(" · ");
  return (
    <div className="map">
      <svg viewBox="0 20 620 560" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Trajet : ${uniq.map((id) => LIEUX[id].nom).join(", ")}`}>
        <path d={DZ_PATH} fill="#fff" stroke="#C9D6DD" strokeWidth="1.5" />
        <polyline className="route" points={pts.map((p) => p.x + "," + p.y).join(" ")} fill="none" stroke="#0F1C24" strokeWidth="2" strokeDasharray="5 4" />
        {labels.map((l) => <line key={"l" + l.id} x1={l.p.x} y1={l.p.y} x2={l.left ? l.lx + 3 : l.lx - 3} y2={l.ly - 4} stroke="#93A3AD" strokeWidth="1" />)}
        {labels.map((l) => <circle key={"c" + l.id} cx={l.p.x} cy={l.p.y} r={seq[0] === l.id ? 7 : 5.5} fill={seq[0] === l.id ? "#F6A72D" : "#0F1C24"} stroke="#fff" strokeWidth="2" />)}
        {labels.map((l) => (
          <text key={"t" + l.id} x={l.lx} y={l.ly} textAnchor={l.left ? "end" : "start"} fontSize="12.5" fontFamily="Poppins, sans-serif" fill="#0b0c0d" stroke="#F3F6F8" strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
            <tspan fontWeight="700">{l.p.nom}</tspan><tspan fill="#5A6A70"> · {dayLabel(l.id)}</tspan>
          </text>
        ))}
      </svg>
      <div className="map__lg">{trame.jours.length} jours · {uniq.length} lieux · {zones}</div>
    </div>
  );
}
