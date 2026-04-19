/** Fuseau affichage produit (stable SSR + navigateur, évite les mismatches d’hydratation). */
const APP_TIME_ZONE = "Europe/Paris";

const shortDateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Date/heure courte en français, identique côté serveur et client pour une même valeur ISO.
 */
export function formatFrDateTimeShort(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return shortDateTime.format(d);
}
