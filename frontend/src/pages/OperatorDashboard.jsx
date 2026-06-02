import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { POPUP_SENSOR_FIELDS, formatSensorValue } from "../constants/sensorMetrics";

function OperatorDashboard() {
  const navigate = useNavigate();
  const [screenhouses, setScreenhouses] = useState([]);
  const [time, setTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = JSON.parse(
    localStorage.getItem("user")
  );
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [latestSensorData, setLatestSensorData] = useState({});
  const mapRef = useRef(null);
  const markerRefs = useRef({});

  useEffect(() => {
    const token =
      localStorage.getItem("token");

    fetch(
      "http://localhost:8000/screenhouses",
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )
      .then((res) => res.json())
      .then(setScreenhouses);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const provinces = [...new Set(screenhouses.map((sh) => sh.province))];

  const districts = [
    ...new Set(
      screenhouses
        .filter((sh) => !selectedProvince || sh.province === selectedProvince)
        .map((sh) => sh.district)
    ),
  ];

  const filteredScreenhouses = screenhouses.filter((sh) => {
    const keyword = search.toLowerCase();

    const matchSearch =
      sh.name?.toLowerCase().includes(keyword) ||
      sh.owner_name?.toLowerCase().includes(keyword) ||
      sh.address_detail?.toLowerCase().includes(keyword) ||
      sh.village?.toLowerCase().includes(keyword) ||
      sh.district?.toLowerCase().includes(keyword) ||
      sh.province?.toLowerCase().includes(keyword);

    const matchProvince = !selectedProvince || sh.province === selectedProvince;

    const matchDistrict = !selectedDistrict || sh.district === selectedDistrict;

    return matchSearch && matchProvince && matchDistrict;
  });

  const fetchLatestSensorData = async (screenhouseId) => {
    try {
      const response = await fetch(
        `http://localhost:8000/sensor-data/latest/${screenhouseId}`
      );

      const data = await response.json();

      setLatestSensorData((prev) => ({
        ...prev,
        [screenhouseId]: data,
      }));
    } catch (err) {
      console.log(err);
    }
  };

  const focusScreenhouse = (screenhouse) => {
    setSelectedId(screenhouse.id);

    if (mapRef.current) {
      mapRef.current.flyTo([screenhouse.latitude, screenhouse.longitude], 15, {
        duration: 1.5,
      });
    }

    setTimeout(() => {
      markerRefs.current[screenhouse.id]?.openPopup();
    }, 800);
  };

  return (
    // fixed inset-0 = fullscreen tanpa scroll, tidak terpengaruh elemen luar
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        screenhouses={screenhouses}
        role={user.role}
        user={user}
      />

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* TOPBAR */}
        <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="text-gray-500" />
            </button>
            <div>
              <div className="text-sm font-semibold text-gray-800 text-left">
                Dashboard operator
              </div>
              <div className="text-xs text-gray-400">
                Monitoring realtime · Jawa Barat
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </div>
            <div className="text-sm font-semibold text-gray-700 tabular-nums">
              {time.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </header>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden">
          {/* MAP */}
          <div className="flex-1 relative overflow-hidden">
            <MapContainer
              center={[-6.9175, 106.9287]}
              zoom={10}
              className="h-full w-full"
              zoomControl={false}
              ref={mapRef}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredScreenhouses.map((sh) => (
                <Marker
                  key={sh.id}
                  position={[sh.latitude, sh.longitude]}
                  eventHandlers={{
                    popupopen: () => fetchLatestSensorData(sh.id),
                  }}
                  ref={(ref) => {
                    markerRefs.current[sh.id] = ref;
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <button
                        type="button"
                        onClick={() => navigate(`/operator/screenhouse/${sh.id}`)}
                        className="text-base font-bold text-emerald-700 hover:text-emerald-900 hover:underline text-left w-full"
                      >
                        {sh.name}
                      </button>
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        Klik nama untuk dashboard detail →
                      </p>

                      {sh.owner_name && (
                        <p className="text-xs text-slate-500 mt-1">
                          👤 {sh.owner_name}
                        </p>
                      )}

                      <p className="text-xs text-slate-500 mt-1">
                        📍{" "}
                        {[sh.address_detail, sh.village, sh.district]
                          .filter(Boolean)
                          .join(", ")}
                      </p>

                      {/* SENSOR */}

                      <div className="mt-4 space-y-2">
                        {!latestSensorData[sh.id] && (
                          <div className="text-xs text-slate-400">
                            Memuat data sensor...
                          </div>
                        )}

                        {latestSensorData[sh.id] && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {POPUP_SENSOR_FIELDS.map(({ key, label, unit }) => (
                                <div key={key} className="bg-slate-50 rounded-lg p-2">
                                  <p className="text-[10px] text-slate-400 uppercase">{label}</p>
                                  <p className="text-sm font-bold text-slate-700">
                                    {formatSensorValue(latestSensorData[sh.id][key], unit)}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {latestSensorData[sh.id].node_name && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                Node: {latestSensorData[sh.id].node_name}
                              </p>
                            )}

                            <div
                              className="mt-3 bg-emerald-50 text-emerald-700 rounded-lg py-2 text-center text-xs font-medium"
                            >
                              Device Online
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* LIST PANEL KANAN */}
          <div className="w-[320px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3border-gray-100">
              <div className="px-4 py-4 border-b border-gray-100 space-y-3">
                <div>
                  <div
                    className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-3"
                  >
                    Daftar screenhouse
                  </div>

                  <input
                    type="text"
                    placeholder="Cari nama, owner, alamat..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);

                      setSelectedDistrict("");
                    }}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Provinsi</option>

                    {provinces.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Kabupaten</option>

                    {districts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredScreenhouses.map((sh, i) => (
                <div
                  key={sh.id}
                  onClick={() => focusScreenhouse(sh)}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl cursor-pointer mb-1
                    border transition
                    ${selectedId === sh.id
                      ? "bg-green-50 border-green-200"
                      : "border-transparent hover:bg-gray-50"
                    }
                  `}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#1e4d2b] text-white text-xs font-medium flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {sh.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {[sh.village, sh.district].filter(Boolean).join(", ")}
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                    Aktif
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperatorDashboard;
