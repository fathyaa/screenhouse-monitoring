import { ChevronLeft, ChevronRight } from "lucide-react";

// Bikin deret nomor halaman ber-window dengan elipsis, mis: 1 … 4 5 [6] 7 8 … 20
function buildPages(page, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Kontrol paginasi sisi-klien. Otomatis tidak tampil kalau cuma 1 halaman.
 * Dipasangkan dengan hook `usePagination`.
 */
export default function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  itemLabel = "data",
  className = "",
}) {
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = buildPages(page, pageCount);

  const btnBase =
    "min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 ${className}`}
    >
      <span className="text-xs text-gray-500">
        Menampilkan {from}–{to} dari {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${btnBase} border border-gray-200 text-gray-600 hover:bg-gray-50`}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="min-w-8 h-8 inline-flex items-center justify-center text-xs text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btnBase} ${
                p === page
                  ? "bg-bl-primary text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className={`${btnBase} border border-gray-200 text-gray-600 hover:bg-gray-50`}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
