"use client";

import Link from "next/link";
import { useState } from "react";
import { projectDeskLink } from "@/lib/assistant/scope";
import type { DeskView, DeskViewItem } from "@/lib/assistant/desk-data";
import type { DeskFact } from "@/lib/assistant/project-readout";
import { DeskGmailMessages } from "./desk-gmail-messages";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Algiers" });
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export type ReadoutFocus = "facts" | "timeline" | "offers";

function formattedDate(value: string) {
  return Number.isFinite(Date.parse(value)) ? date.format(new Date(value)) : "Date inconnue";
}

export function DeskCopy({ value, label = "Copier" }: { value: string; label?: string }) {
  const [status, setStatus] = useState("");
  return <div className="row wrap">
    <button className="btn s xs" type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setStatus("Copié."); }
      catch { setStatus("Sélectionne le texte pour le copier."); }
    }}>{label}</button>
    <span className="mt" role="status">{status}</span>
  </div>;
}

function DeskReadoutItems({ items }: { items: DeskViewItem[] }) {
  return <ul className="desk-assistant__items">
    {items.map((item, index) => <li key={(item.href ?? item.title) + index}>
      <div className="desk-assistant__item-title">
        {item.href ? <Link href={item.href}>{item.title}</Link> : <b>{item.title}</b>}
        {item.tag && <span className="tag">{item.tag}</span>}
      </div>
      {item.reference && <small>{item.reference}</small>}
      {item.detail && <p>{item.detail}</p>}
      {item.draft && <details className="desk-assistant__disclosure">
        <summary>Relire le brouillon</summary>
        <div className="desk-assistant__draft-text">{item.draft}</div>
        <DeskCopy value={item.draft} label="Copier la relance" />
      </details>}
    </li>)}
  </ul>;
}

function FactList({ facts }: { facts: DeskFact[] }) {
  return <dl className="desk-assistant__facts">{facts.map(({ label, value }) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function exportDeskRows(view: DeskView) {
  const cell = (value: string | undefined) => {
    const text = value ?? "";
    return '"' + (/^[=+\-@\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  const rows = [["Référence", "Libellé", "Statut", "Détail"], ...view.items.map(item => [item.reference, item.title, item.tag, item.detail])];
  const file = new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "desk-extrait.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function DeskReadout({ view, focus, onPin, allowExport = false }: {
  view: DeskView;
  focus?: ReadoutFocus;
  onPin?: (id: string) => void;
  allowExport?: boolean;
}) {
  const p = view.project;
  return <section className="desk-assistant__readout" aria-label={p ? "Parcours du dossier" : view.heading}>
    <div className="desk-assistant__readout-head">
      <div>
        {p && <small>{p.ref}</small>}
        <h3>{view.heading}</h3>
      </div>
      {p && <span className="tag amber">{p.stage}</span>}
    </div>
    <p>{view.summary}</p>
    {p && <>
      <Link href={p.next.href} className="desk-assistant__next">
        <span>Prochaine action</span><strong>{p.next.label}</strong>{p.next.detail !== view.summary && <small>{p.next.detail}</small>}
      </Link>
      {!!p.gmailOffers && <Link className="desk-assistant__source" href={projectDeskLink(p.id, "props")}>
        {p.gmailOffers} proposition(s) Gmail à vérifier
      </Link>}
      {p.facts.length > 0 && <details className="desk-assistant__disclosure" open={focus === "facts" || undefined}>
        <summary>Trame actuelle et réponses récentes</summary>
        {!!p.travelerUpdates.length && <ol className="desk-assistant__timeline" aria-label="Réponses du voyageur">
          {p.travelerUpdates.map((event, index) => <li key={event.at + index}>
            <time dateTime={event.at}>{formattedDate(event.at)}</time>
            <b>Réponses du voyageur</b>{event.detail && <p>{event.detail}</p>}
          </li>)}
        </ol>}
        <FactList facts={p.facts} />
        <Link className="desk-assistant__source" href={projectDeskLink(p.id, "trame")}>Voir la trame du dossier</Link>
      </details>}
      {!!p.qualification.length && <details className="desk-assistant__disclosure">
        <summary>Qualification importée par DA Sales</summary>
        <FactList facts={p.qualification} />
      </details>}
      {!!p.initial.length && <details className="desk-assistant__disclosure">
        <summary>Demande initiale et évolutions</summary>
        <FactList facts={p.initial} />
        {!!p.sinceIntake.length && <div className="desk-assistant__table-wrap">
          <table className="desk-assistant__table">
            <thead><tr><th>Champ</th><th>À l’origine</th><th>Maintenant</th></tr></thead>
            <tbody>{p.sinceIntake.map(change => <tr key={change.label}><th scope="row">{change.label}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody>
          </table>
        </div>}
      </details>}
      {p.timeline.length > 0 && <details className="desk-assistant__disclosure" open={focus === "timeline" || focus === "facts" || undefined}>
        <summary>Historique des actions <small>{p.timeline.length}</small></summary>
        <ol className="desk-assistant__timeline">
          {p.timeline.map((event, i) => <li key={event.at + i}>
            <time dateTime={event.at}>{formattedDate(event.at)}</time>
            <Link href={projectDeskLink(p.id, event.tab)}>{event.title}</Link>
            {event.detail && <p>{event.detail}</p>}
          </li>)}
        </ol>
      </details>}
      {p.offers.length > 0 && <details className="desk-assistant__disclosure" open={focus === "offers" || undefined}>
        <summary>Comparer les propositions <small>{p.offers.length}</small></summary>
        <div className="desk-assistant__table-wrap">
          <table className="desk-assistant__table">
            <thead><tr><th>Agence</th><th>Prix / pers.</th><th>Durée</th></tr></thead>
            <tbody>{p.offers.map(offer => <tr key={offer.id}>
              <th scope="row">{offer.agency}{offer.selected && <small>Retenue</small>}</th>
              <td>{offer.price !== null ? currency.format(offer.price) : "À préciser"}</td>
              <td>{offer.days !== null ? offer.days + " j" : "À préciser"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <DeskReadoutItems items={p.offers.filter(offer => offer.summary || offer.differences).map(offer => ({
          title: offer.agency, detail: [offer.summary, offer.differences].filter(Boolean).join(" · "),
        }))} />
        <Link className="desk-assistant__source" href={projectDeskLink(p.id, "props")}>Ouvrir les propositions</Link>
      </details>}
      {focus === "offers" && !p.offers.length && <p>Aucune proposition d’agence n’a été enregistrée dans ce dossier.</p>}
      {p.quote && <div className="desk-assistant__quote">
        <span>{p.quote.sentAt ? "Devis envoyé le " + formattedDate(p.quote.sentAt) : "Devis en brouillon"}
          {p.quote.price > 0 && <small> · {currency.format(p.quote.price)} / pers.</small>}
          {p.quote.validDays > 0 && <small> · valable {p.quote.validDays} j</small>}</span>
        <a href={"/api/leads/" + p.id + "/quotes/" + p.quote.id + "/pdf"} target="_blank" rel="noreferrer">Relire le PDF</a>
      </div>}
      {!!view.related?.length && <details className="desk-assistant__disclosure">
        <summary>Autres dossiers liés à ce voyageur</summary>
        <DeskReadoutItems items={view.related} />
      </details>}
      {onPin && <button className="btn s sm" type="button" onClick={() => onPin(p.id)}>Épingler {p.title}</button>}
    </>}
    {view.inbound && <section aria-label="E-mails du dossier">
      <b>E-mails reçus dans Gmail</b>
      {view.inbound.length ? <DeskGmailMessages messages={view.inbound} /> : <p>Aucun e-mail rapproché de ce dossier.</p>}
    </section>}
    {view.stats && <dl className="desk-assistant__facts desk-assistant__facts--grid">
      {view.stats.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
    {view.items.length > 0 && <DeskReadoutItems items={view.items} />}
    {allowExport && view.items.length > 0 && <button className="btn s xs" type="button" onClick={() => exportDeskRows(view)}>Exporter cette vue en CSV</button>}
  </section>;
}
