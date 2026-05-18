import { useEffect, useState } from "react";
import { Leaf, Wifi, Bell, Thermometer, Droplets, Activity, MapPin, Clock3, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import { useAlerts } from "../context/AlertContext";
import PetaniTopbar from "../layouts/PetaniTopbar";

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [latestSensorData, setLatestSensorData] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const { activeCount } = useAlerts();

  useEffect(() => {
    fetch("http://localhost:8000/screenhouses/my-screenhouses", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setScreenhouses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("http://localhost:8000/sensor-data/latest", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const mapped = {};
        data.forEach((item) => { mapped[item.screenhouse_id] = item; });
        setLatestSensorData(mapped);
      })
      .catch(console.error);
  }, []);

  const summaryCards = [
    { label: "Screenhouse", value: screenhouses.length, icon: Leaf, bg: "bg-green-50", color: "text-green-700" },
    { label: "Device online", value: screenhouses.length * 4, icon: Wifi, bg: "bg-blue-50", color: "text-blue-700" },
    { label: "Alert aktif", value: activeCount, icon: Bell, bg: "bg-red-50", color: "text-red-600", valColor: "text-red-600" },
    { label: "Sensor aktif", value: screenhouses.length * 6, icon: Activity, bg: "bg-green-50", color: "text-green-700" },
  ];

  const sensorKeys = [
    { label: "Nitrogen", icon: Leaf, key: "nitrogen" },
    { label: "Kelembapan", icon: Droplets, key: "moisture" },
    { label: "Phosphorus", icon: Activity, key: "phosphorus" },
    { label: "Potassium", icon: Activity, key: "potassium" },
    { label: "Suhu", icon: Thermometer, key: "suhu" },
    { label: "pH Tanah", icon: Activity, key: "ph" },
  ];

  return (
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden text-left">
      <Sidebar isOpen={sidebarOpen} screenhouses={screenhouses} role={user?.role} user={user} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* TOPBAR */}
        <PetaniTopbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Dashboard petani"
          subtitle={`Halo, ${user?.name} — pantau screenhouse kamu`}
          activeAlerts={activeCount}
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* GREETING */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-gray-800">Selamat pagi, {user?.name} 👋</div>
              <div className="text-sm text-gray-400 mt-0.5">
                {activeCount > 0 ? `Ada ${activeCount} alert aktif yang perlu ditangani` : "Semua screenhouse dalam kondisi normal"}
              </div>
            </div>
            <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ${activeCount > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${activeCount > 0 ? "bg-red-500" : "bg-green-500"}`} />
              <div>
                <div className={`text-xs font-semibold ${activeCount > 0 ? "text-red-800" : "text-green-800"}`}>
                  {activeCount > 0 ? `${activeCount} alert aktif` : "Semua device online"}
                </div>
                <div className={`text-xs mt-0.5 ${activeCount > 0 ? "text-red-600" : "text-green-600"}`}>
                  {activeCount > 0 ? "Periksa tab Notifikasi" : "Monitoring berjalan normal"}
                </div>
              </div>
            </div>
          </div>

          {/* SUMMARY */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card.bg}`}>
                  <card.icon size={17} className={card.color} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${card.valColor ?? "text-gray-800"}`}>{card.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* SCREENHOUSE GRID */}
          <div>
            <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
            <div className="text-xs text-gray-400 mt-0.5 mb-3">Monitoring realtime seluruh screenhouse</div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {screenhouses.map((sh) => {
              const sensor = latestSensorData[sh.id?.toString()];
              return (
                <div key={sh.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-gray-100 flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{sh.name}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={12} />{sh.village}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock3 size={12} />
                          {sensor?.created_at
                            ? new Date(sensor.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                            : "—"
                          }
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">Online</span>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-2">
                    {sensorKeys.map(({ label, icon: Icon, key }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
                          <div className="text-base font-semibold text-gray-800 mt-1">
                            {sensor?.[key] ?? "—"}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                          <Icon size={15} className="text-green-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

export default PetaniDashboard;