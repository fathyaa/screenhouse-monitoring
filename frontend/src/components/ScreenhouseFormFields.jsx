import { Leaf, MapPin, Layers } from "lucide-react";
import LocationPickerMap from "./LocationPickerMap";

/**
 * Field-field form data screenhouse (nama, alamat, rak, peta, wilayah).
 * Dipakai oleh RegisterScreenhousePage (alur registrasi) dan PetaniAjukanScreenhousePage
 * (pengajuan screenhouse tambahan) — keduanya punya chrome & submit yang berbeda,
 * tapi isi form-nya identik. Varietas dipilih saat mulai siklus semai, bukan di sini.
 */
export default function ScreenhouseFormFields({
  screenhouse,
  setScreenhouse,
  wilayah,
  wilayahError,
  resolving,
  handleMapPick,
  compact = false,
}) {
  const labelCls = compact
    ? "block text-xs font-semibold text-gray-700 mb-1.5"
    : "block text-sm font-medium text-gray-600 mb-2";
  const hintCls = compact ? "text-[11px] text-gray-600 mt-1" : "text-xs text-gray-600 mt-2";
  const inputRowCls = compact
    ? "flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50"
    : "flex items-center gap-3 h-12 px-4 border border-gray-200 rounded-xl bg-gray-50";
  const textareaRowCls = compact
    ? "flex items-start gap-2 min-h-10 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
    : "flex items-start gap-3 min-h-12 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50";
  const iconSize = compact ? 14 : 16;

  return (
    <>
      <div>
        <label className={labelCls}>Nama screenhouse</label>
        <div className={inputRowCls}>
          <Leaf size={iconSize} className="text-gray-600 shrink-0" />
          <input
            type="text"
            value={screenhouse.name}
            onChange={(e) => setScreenhouse({ ...screenhouse, name: e.target.value })}
            placeholder="Contoh: Screenhouse Sukabumi 01"
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Detail alamat (opsional)</label>
        <div className={textareaRowCls}>
          <MapPin size={iconSize} className="text-gray-600 shrink-0 mt-0.5" />
          <textarea
            value={screenhouse.address_detail}
            onChange={(e) => setScreenhouse({ ...screenhouse, address_detail: e.target.value })}
            placeholder="Contoh: Dekat irigasi timur, blok A"
            rows={2}
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 resize-none"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Jumlah rak bibit terpasang</label>
        <div className={inputRowCls}>
          <Layers size={iconSize} className="text-gray-600 shrink-0" />
          <input
            type="number"
            min={1}
            max={20}
            value={screenhouse.tray_count}
            onChange={(e) => setScreenhouse({ ...screenhouse, tray_count: e.target.value })}
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
          />
        </div>
        <p className={hintCls}>
          Satu rak bibit memakai satu alat pengukur. Operator dapat menyesuaikan saat verifikasi.
        </p>
      </div>

      <div>
        {!compact && <label className={labelCls}>Lokasi di peta</label>}
        <LocationPickerMap
          latitude={screenhouse.latitude}
          longitude={screenhouse.longitude}
          onChange={handleMapPick}
          className={`w-full rounded-xl overflow-hidden border border-gray-200 z-0 ${compact ? "h-52" : "h-56"}`}
        />
        {screenhouse.latitude != null && (
          <p className={`${hintCls} font-medium`}>
            Koordinat: {screenhouse.latitude}, {screenhouse.longitude}
          </p>
        )}
      </div>

      <div
        className={
          compact
            ? "rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5"
            : "rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2"
        }
      >
        <div className={compact ? "text-xs font-medium text-gray-600" : "text-sm font-medium text-gray-600"}>
          Wilayah (otomatis dari peta)
        </div>
        {resolving && (
          <p className={compact ? "text-xs text-gray-600" : "text-sm text-gray-600"}>Membaca wilayah...</p>
        )}
        {!resolving && wilayah && (
          <>
            <p className={compact ? "text-xs text-gray-700" : "text-sm text-gray-700"}>
              {[wilayah.village, wilayah.district, wilayah.regency, wilayah.province]
                .filter(Boolean)
                .join(", ")}
            </p>
            {!compact && wilayah.display_name && (
              <p className="text-xs text-gray-600">{wilayah.display_name}</p>
            )}
          </>
        )}
        {!resolving && !wilayah && wilayahError && (
          <p className={compact ? "text-xs text-amber-700" : "text-sm text-amber-700"}>{wilayahError}</p>
        )}
        {!resolving && !wilayah && !wilayahError && (
          <p className={compact ? "text-xs text-gray-600" : "text-sm text-gray-600"}>
            Pilih titik di peta untuk mengisi wilayah
          </p>
        )}
      </div>
    </>
  );
}
