import { useEffect, useMemo, useState } from "react";

/**
 * Paginasi sisi-klien untuk list yang datanya sudah di-fetch penuh lalu
 * difilter di memori. Reset otomatis ke halaman 1 saat `resetKey` berubah
 * (mis. saat filter/pencarian berubah) dan meng-clamp halaman saat jumlah
 * data mengecil.
 *
 * @param {Array} items daftar (sudah terfilter) yang mau dipaginasi
 * @param {number} pageSize jumlah item per halaman
 * @param {*} resetKey nilai apa pun; saat berubah, halaman balik ke 1
 */
export function usePagination(items, pageSize = 10, resetKey) {
  const [page, setPage] = useState(1);
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize]);

  const startIndex = (page - 1) * pageSize;

  return { page, setPage, pageItems, pageCount, total, pageSize, startIndex };
}
