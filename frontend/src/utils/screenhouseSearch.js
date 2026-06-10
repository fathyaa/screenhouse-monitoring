/** Cocokkan query dengan nama screenhouse saja. */
export function screenhouseMatchesQuery(sh, rawQuery) {
  const q = String(rawQuery ?? "").trim().toLowerCase();
  if (!q) return true;

  const name = String(sh?.name ?? "").toLowerCase();
  return name.includes(q);
}
