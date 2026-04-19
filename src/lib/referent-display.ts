export type ReferentDisplayRow = {
  id: string;
  full_name: string | null | undefined;
  email?: string | null | undefined;
};

/** Libellé liste déroulante / en-tête : nom complet, sinon email, sinon début d’UUID. */
export function referentDisplayLabel(r: ReferentDisplayRow): string {
  const name = (r.full_name ?? "").trim();
  if (name) return name;
  const mail = (r.email ?? "").trim();
  if (mail) return mail;
  return `Profil ${r.id.slice(0, 8)}…`;
}
