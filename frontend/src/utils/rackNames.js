/** Tampilkan nama rak bibit ramah pengguna — tanpa kode teknis (T01, SH-1-T01, dll). */
export function formatRackName(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return "Rak bibit";

  const legacyTray = raw.match(/^Tray\s+T?0*(\d+)$/i);
  if (legacyTray) return `Rak bibit ${Number(legacyTray[1])}`;

  return raw.replace(/^Tray\s+/i, "").trim() || "Rak bibit";
}

export function defaultRackName(index) {
  return `Rak bibit ${index}`;
}
