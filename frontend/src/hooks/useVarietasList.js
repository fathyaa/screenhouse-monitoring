import { useEffect, useState } from "react";
import { API_URL } from "../config/api";

/**
 * Ambil daftar varietas bibit dari `/varietas-bibit`.
 * Dipakai bersama supaya halaman dengan banyak selector (mis. ApprovalPage
 * dengan banyak kartu pending) cukup fetch sekali di parent, bukan per-instance.
 * Set `enabled: false` untuk melewati fetch (mis. VarietasSelect yang sudah
 * dioper `options` dari luar).
 */
export default function useVarietasList(token = null, { enabled = true } = {}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    setLoading(true);
    fetch(`${API_URL}/varietas-bibit`, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  return { list, loading };
}
