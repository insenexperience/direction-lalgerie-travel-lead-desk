/** Simple relative time formatter (no external deps). */
export function formatDistanceToNow(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH   / 24);

  if (diffMin < 1)  return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH   < 24) return `Il y a ${diffH} h`;
  if (diffD   < 7)  return `Il y a ${diffD} j`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `Il y a ${diffW} sem.`;
  const diffM = Math.floor(diffD / 30);
  return `Il y a ${diffM} mois`;
}
