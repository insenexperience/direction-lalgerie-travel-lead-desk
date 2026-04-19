/** Erreur PostgREST / Postgres « colonne inexistante » (schéma sans migration v2). */
export function isPostgresUndefinedColumnError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (String(error.code) === "42703") return true;
  return /column .+ does not exist/i.test(String(error.message ?? ""));
}
