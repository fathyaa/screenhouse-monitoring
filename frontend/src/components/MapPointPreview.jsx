import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { X } from "lucide-react";

export default function MapPointPreview({
  open,
  onClose,
  latitude,
  longitude,
  title,
  subtitle,
}) {
  if (!open || latitude == null || longitude == null) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{title}</div>
            {subtitle && (
              <div className="text-xs text-gray-600 font-medium mt-0.5 truncate">{subtitle}</div>
            )}
            <div className="text-[11px] text-gray-600 mt-1">
              {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 font-medium shrink-0"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="h-64 w-full">
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[latitude, longitude]} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
