import type { ReactNode } from "react";
import type { DemandeProjetIntake } from "@/lib/demande-projet-intake";

const selectionTypes: Record<string, string> = {
  regions: "Région",
  territoires: "Territoire",
  villes: "Ville",
  lieux: "Lieu",
  activites: "Activité",
  experiences: "Expérience",
  circuits: "Circuit",
  pepites: "Pépite",
};

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
        {value || "Non renseigné"}
      </dd>
    </div>
  );
}

export function LeadDemandeProjetProfile({
  demande, email, phone,
}: { demande: DemandeProjetIntake; email: string | null; phone: string | null }) {
  const address = email?.trim();
  const number = phone?.trim();
  const dialNumber = number?.replace(/[\s().-]/g, "") ?? "";
  const emailLink = address && /^[^\s@,;?:#<>]+@[^\s@,;?:#<>]+$/.test(address)
    ? `mailto:${encodeURIComponent(address).replace("%40", "@")}`
    : null;

  return (
    <section className="lead-traveler-overview grid2" aria-label="Coordonnées et profil du voyageur">
      <div>
        <h2>Coordonnées</h2>
        <dl className="lead-traveler-contact">
          <Detail label="E-mail" value={emailLink ? <a href={emailLink}>{address}</a> : address} />
          <Detail label="Téléphone" value={/^\+?\d{6,15}$/.test(dialNumber) ? <a href={`tel:${dialNumber}`}>{number}</a> : number} />
          <Detail label="Canal souhaité" value={demande.contact.channel} />
          <Detail label="Pays de résidence" value={demande.contact.country} />
        </dl>
      </div>
      <div>
        <h2>Profil voyageur</h2>
        <dl className="lead-traveler-profile">
          <Detail label="Groupe déclaré" value={demande.travelers.label} />
          <Detail label="Manières de voyager" value={demande.wishes.styles.join(" · ")} />
          <Detail label="Confort souhaité" value={demande.wishes.comfort} />
        </dl>
      </div>
    </section>
  );
}

/** La demande à réception reste distincte des corrections et de la qualification du conseiller. */
export function LeadDemandeProjetSummary({ demande }: { demande: DemandeProjetIntake | null }) {
  if (!demande) return null;

  const selection = demande.wishes.selection;
  const destination = [...demande.destination.regionNames, ...demande.destination.names].join(" · ") ||
    (demande.destination.unknown ? "À définir avec le voyageur" : "Non renseignée");

  return (
    <section className="rounded-lg border border-steel/20 bg-panel p-4 sm:p-5" aria-label="Demande initiale du voyageur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-foreground">Demande initiale du voyageur</h2>
        <span className="rounded-full bg-panel-muted px-2.5 py-1 text-xs font-medium text-steel">Formulaire du site</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Choix transmis à l’envoi, conservés pour préparer la qualification.</p>

      <div className="mt-4 rounded-md border border-border bg-panel-muted/40 p-3">
        <h3 className="text-sm font-semibold text-steel">
          Envies sélectionnées <span className="font-normal text-muted-foreground">({selection.length})</span>
        </h3>
        {selection.length ? (
          <ul className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-steel sm:grid-cols-2" aria-label="Toutes les envies sélectionnées" tabIndex={selection.length > 8 ? 0 : undefined}>
            {selection.map((envie, index) => {
              const category = envie.key.split(":")[0];
              const label = Object.hasOwn(selectionTypes, category) ? selectionTypes[category] : null;
              return (
                <li key={`${envie.key}:${index}`} className="min-w-0 rounded border border-border bg-panel px-3 py-2">
                  <span className="block break-words text-sm font-medium text-foreground">{envie.name}</span>
                  {label && <span className="mt-0.5 block text-xs text-muted-foreground">{label}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Aucune envie ajoutée depuis le guide.</p>
        )}
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Detail label="Destinations souhaitées" value={destination} />
        <Detail label="Période · durée" value={demande.timing.label} />
        {demande.wishes.message ? (
          <div className="sm:col-span-2">
            <Detail label="Message du voyageur" value={demande.wishes.message} />
          </div>
        ) : null}
      </dl>
    </section>
  );
}
