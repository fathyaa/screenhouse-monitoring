import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Search } from "lucide-react";

const API = "http://localhost:8000";
const DEFAULT_CENTER = [-6.9175, 106.9287];

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ latitude, longitude, zoom = 15 }) {
  const map = useMap();
  useEffect(() => {
    if (latitude != null && longitude != null) {
      map.flyTo([latitude, longitude], zoom, { duration: 1 });
    }
  }, [latitude, longitude, zoom, map]);
  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  className = "h-56 w-full rounded-xl overflow-hidden border border-gray-200",
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const hasPoint = latitude != null && longitude != null;
  const center = hasPoint ? [latitude, longitude] : DEFAULT_CENTER;

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${API}/wilayah/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (item) => {
    onChange(item.lat, item.lon);
    setShowResults(false);
    setQuery(item.display_name);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 h-10 px-3 border border-gray-200 rounded-lg bg-gray-50">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
              placeholder="Cari alamat, desa, atau landmark..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="h-10 px-4 rounded-lg bg-[#1e4d2b] hover:bg-[#2d6e3e] text-white text-xs font-medium disabled:opacity-50"
          >
            {searching ? "..." : "Cari"}
          </button>
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
            {results.map((item, idx) => (
              <button
                key={`${item.lat}-${item.lon}-${idx}`}
                type="button"
                onClick={() => pickResult(item)}
                className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                {item.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Cari alamat atau klik peta untuk menandai lokasi. Marker bisa digeser.
      </p>

      <div className={className}>
        <MapContainer
          center={center}
          zoom={hasPoint ? 14 : 10}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyTo latitude={latitude} longitude={longitude} />
          <MapClickHandler onPick={onChange} />
          {hasPoint && (
            <Marker
              position={[latitude, longitude]}
              draggable
              eventHandlers={{
                dragend(e) {
                  const { lat, lng } = e.target.getLatLng();
                  onChange(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
