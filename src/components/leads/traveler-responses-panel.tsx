import { MessageSquareText } from "lucide-react";
import { parseTravelerResponses } from "@/lib/traveler-requalification";

type Props = {
  responses: Record<string, unknown> | null;
  submittedAt: string | null;
};

const LABELS: Record<string, string> = {
  // Chambres
  two_rooms: "Deux chambres",
  triple: "Une chambre triple",
  suite: "Suite familiale",
  advise: "Conseillez-nous",
  // Passeports
  algerian: "Algérien",
  french: "Français",
  both: "Les deux",
  other: "Autre",
  // Vols
  include: "À intégrer au dossier",
  already_booked: "Déjà réservés",
  self_managed: "Le voyageur s'en occupe",
  // Rythme
  intense: "On bouge beaucoup",
  balanced: "Équilibré",
  slow: "Tranquille, on savoure",
  // Structure
  fixed: "Itinéraire précis",
  flexible: "Trame souple",
  full_trust: "Confiance totale",
  // Business
  none: "Pas un sujet",
  curiosity: "Curiosité au fil du voyage",
  meetings: "Rencontres pro à organiser",
  // Accompagnement
  full_guide: "Chauffeur-guide tout le séjour",
  partial: "Ponctuel selon les étapes",
  // Pension
  breakfast: "Petits-déjeuners",
  half_board: "Demi-pension",
  mixed: "Mixte selon les étapes",
  // Incontournables (ids grille)
  casbah: "Casbah d'Alger",
  tipaza: "Tipaza",
  constantine: "Constantine",
  kabylie: "Kabylie",
  bejaia: "Béjaïa & la côte",
  ghardaia: "Ghardaïa / M'Zab",
  sahara: "Sahara / dunes",
  hoggar: "Hoggar / Tamanrasset",
  tassili: "Tassili n'Ajjer",
  // Contraintes (ids grille)
  halal: "Halal strict",
  vegetarian: "Végétarien / végétalien",
  allergies: "Allergies alimentaires",
  no_alcohol: "Sans alcool",
  mobility: "Mobilité réduite",
  child_friendly: "Jeunes enfants",
};

function label(id: string): string {
  return LABELS[id] ?? id;
}

function formatDateFr(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function Line({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{l}</dt>
      <dd className="text-[12px] font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function TravelerResponsesPanel({ responses, submittedAt }: Props) {
  if (!responses) return null;
  const r = parseTravelerResponses(responses);
  if (!r) return null;

  const ages = r.travelers.map((t) => t.age).join(", ");
  const passports = r.passports
    .map((p, i) => `V${i + 1} : ${label(p)}`)
    .join(" · ");
  const flights =
    label(r.flights.mode) +
    (r.flights.departure_city ? ` — départ ${r.flights.departure_city}` : "");
  const mustSee = r.wishes.must_see.map(label).join(", ");
  const diet = r.constraints.diet.map(label).join(", ");

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        <MessageSquareText className="size-3 shrink-0" aria-hidden />
        Réponses voyageur
        {submittedAt ? (
          <span className="font-normal normal-case tracking-normal text-muted-foreground">
            · reçues le {formatDateFr(submittedAt)}
          </span>
        ) : null}
      </p>

      <dl className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-border bg-panel-muted/40 p-3 sm:grid-cols-2">
        <Line label="Âges des voyageurs" value={ages} />
        <Line label="Chambres" value={label(r.rooms)} />
        <Line label="Passeports" value={passports} />
        <Line label="Vols" value={flights} />
        <Line label="Incontournables" value={mustSee} />
        <Line
          label="Rythme & structure"
          value={`${label(r.wishes.rhythm)} · ${label(r.wishes.structure)}`}
        />
        <Line label="Algérie business" value={label(r.business.mode)} />
        <Line label="Accompagnement" value={label(r.constraints.accompaniment)} />
        <Line label="Pension" value={label(r.constraints.board)} />
        <Line label="Contraintes" value={diet} />
        {r.wishes.family_days ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] text-muted-foreground">
              Famille à visiter / jours libres
            </dt>
            <dd className="text-[12px] font-medium text-foreground">
              {r.wishes.family_days}
            </dd>
          </div>
        ) : null}
        {r.business.details ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] text-muted-foreground">
              Précisions business
            </dt>
            <dd className="text-[12px] font-medium text-foreground">
              {r.business.details}
            </dd>
          </div>
        ) : null}
        {r.wishes.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] text-muted-foreground">Autre (envies)</dt>
            <dd className="text-[12px] font-medium text-foreground">
              {r.wishes.notes}
            </dd>
          </div>
        ) : null}
        {r.constraints.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] text-muted-foreground">
              Santé / précisions
            </dt>
            <dd className="text-[12px] font-medium text-foreground">
              {r.constraints.notes}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
