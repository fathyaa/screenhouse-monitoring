// Util sesi auth berbasis localStorage.
// Login menyimpan JWT di `token`; gate route hanya cek keberadaannya, sehingga
// token kadaluarsa baru ketahuan saat request pertama gagal. Helper di sini
// memvalidasi `exp` JWT lebih awal supaya gate bisa menolak sebelum halaman render.

const SESSION_KEYS = ["token", "role", "user", "push_subscribed", "push_muted"];

/** Hapus semua key sesi (dipakai saat logout & saat token invalid/kadaluarsa). */
export function clearSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

/** Decode payload JWT dengan aman; null bila format tidak valid. */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * True bila token ada dan belum kadaluarsa. Token yang tidak bisa di-decode
 * dianggap tidak valid. Token tanpa klaim `exp` dianggap valid (tidak ada
 * info kadaluarsa untuk ditolak).
 */
export function isTokenValid(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (typeof payload.exp !== "number") return true;
  return payload.exp * 1000 > Date.now();
}
