/** Read-only projection of the website's request; the original trame remains the source of truth. */
export interface DemandeProjetIntake {
  destination: { unknown: boolean; names: string[]; territories: string[]; regions: string[]; regionNames: string[] };
  timing: {
    mode: "mois" | "dates" | "nsp" | null;
    months: string[]; start: string | null; end: string | null;
    approximate: boolean; duration: string; period: string; label: string;
  };
  travelers: { type: string; adults: number | null; children: number | null; label: string };
  wishes: { selection: { key: string; name: string }[]; styles: string[]; styleIds: string[]; comfort: string; message: string };
  contact: { country: string; channel: string };
  consent: { accepted: boolean | null; at: string; text: string };
  origin: { from: string; page: string };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function date(value: unknown): string | null {
  const s = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s ? s : null;
}
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// Current website catalogue labels; unknown historical keys remain visible as their original identifier.
const REGIONS: Record<string, string> = { centre: "Le Centre", est: "L’Est", ouest: "L’Ouest", "sud-est": "Le Sud-Est", "sud-ouest": "Le Sud-Ouest", "grand-sud": "Le Grand Sud" };

/** Accept an intake_payload, never reinterpret an older composeur payload as a new request. */
export function readDemandeProjet(intakePayload: unknown): DemandeProjetIntake | null {
  const trame = object(object(intakePayload).trame);
  if (trame.type !== "demande-projet-voyage") return null;
  const ou = object(trame.ou), quand = object(trame.quand), groupe = object(trame.voyageurs);
  const envies = object(trame.envies), contact = object(trame.contact), accord = object(trame.accord), entree = object(trame.entree);
  const mode = quand.mode === "mois" || quand.mode === "dates" || quand.mode === "nsp" ? quand.mode : null;
  const months = mode === "mois" ? strings(quand.mois).filter(m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)) : [];
  const dates = object(quand.dates);
  let start = mode === "dates" ? date(dates.arrivee) : null;
  let end = mode === "dates" ? date(dates.depart) : null;
  // Malformed dates stay available in the original payload, but never enter typed DB columns.
  if (start && end && start > end) { start = null; end = null; }
  const approximate = mode === "dates" && dates.aQuelquesJoursPres === true;
  const duration = text(quand.duree);
  const period = mode === "mois"
    ? months.map(m => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`).join(" ou ")
    : mode === "nsp" ? "À définir avec votre conseiller"
    : mode === "dates" && (start || end) ? `${start || "À préciser"} → ${end || "À préciser"}${approximate ? ", à quelques jours près" : ""}` : "";
  const adults = count(groupe.adultes), children = count(groupe.enfants), groupType = text(groupe.type);
  const composition = [adults === null ? "" : `${adults} adulte${adults === 1 ? "" : "s"}`, children === null ? "" : `${children} enfant${children === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  const selection = Array.isArray(envies.selection) ? envies.selection.flatMap(value => {
    const item = object(value), key = text(item.cle), name = text(item.nom);
    return key || name ? [{ key, name: name || key }] : [];
  }) : [];
  const regions = strings(ou.superRegions), regionNames = strings(ou.nomsSuperRegions);
  return {
    destination: { unknown: ou.jeNeSaisPas === true, names: strings(ou.noms), territories: strings(ou.territoires), regions, regionNames: regionNames.length ? regionNames : regions.map(id => REGIONS[id] || id) },
    timing: { mode, months, start, end, approximate, duration, period, label: [period, duration].filter(Boolean).join(" · ") },
    travelers: { type: groupType, adults, children, label: [groupType, composition].filter(Boolean).join(" · ") },
    wishes: { selection, styles: strings(envies.libelles), styleIds: strings(envies.manieres), comfort: text(envies.confort), message: text(envies.message) },
    contact: { country: text(contact.paysResidence), channel: text(contact.canal) },
    consent: { accepted: typeof accord.accepte === "boolean" ? accord.accepte : null, at: text(accord.horodatage), text: text(accord.texte) },
    origin: { from: text(entree.depuis), page: text(entree.page) },
  };
}

/** Searchable, unabridged travel context, excluding the private contact/consent fields. */
export function demandeProjetDescription(demande: DemandeProjetIntake): string {
  const { destination, timing, travelers, wishes } = demande;
  const places = destination.names.length ? destination.names : destination.territories;
  return [
    destination.unknown ? "Destination : à définir avec le conseiller" : [
      destination.regionNames.length ? `Grandes régions : ${destination.regionNames.join(" · ")}` : "",
      places.length ? `Destinations : ${places.join(" · ")}` : "",
    ].filter(Boolean).join("\n"),
    timing.label && `Quand : ${timing.label}`,
    travelers.label && `Voyageurs : ${travelers.label}`,
    wishes.selection.length ? `Envies gardées :\n${wishes.selection.map(e => `- ${e.name}${e.key ? ` (${e.key})` : ""}`).join("\n")}` : "",
    wishes.styles.length ? `Manières de voyager : ${wishes.styles.join(" · ")}` : "",
    wishes.comfort && `Confort : ${wishes.comfort}`,
    wishes.message && `Message du voyageur :\n${wishes.message}`,
  ].filter(Boolean).join("\n\n");
}
