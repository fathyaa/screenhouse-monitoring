import { useEffect, useState } from "react";
import { Leaf, Wifi, Bell, Thermometer, Droplets, Activity, MapPin, Clock3, Menu } from "lucide-react";
import Sidebar from "../layouts/Sidebar";
import socket from "../lib/socket";

function PetaniDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = { name: "Pak Eko", role: "petani" };
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3003/screenhouses/my-screenhouses", {
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InBldGFuaSIsImlhdCI6MTc3ODQxNjMzNywiZXhwIjoxNzc5MDIxMTM3fQ.fjokpCmOUht48v5lcnHlWP-Y3gifQ06wCXO4uAl8plI" },
    })
      .then((res) => res.json())
      .then(setScreenhouses);
  }, []);

  useEffect(() => {

    socket.on(
      "alert-update",
      (alert) => {
        setAlerts((prev) => [
          {
            ...alert,
            status: "aktif",
          },
          ...prev,
        ]);
      }
    );

    return () => {
      socket.off(
        "alert-update"
      );
    };

  }, []);

  const activeAlerts = alerts.filter(
    (a) => a.status === "aktif"
  ).length;

  const summaryCards = [
    { label: "Screenhouse", value: screenhouses.length, icon: Leaf, bg: "bg-green-50", color: "text-green-700" },
    { label: "Device online", value: screenhouses.length * 4, icon: Wifi, bg: "bg-blue-50", color: "text-blue-700" },
    { label: "Alert aktif", value: activeAlerts, icon: Bell, bg: "bg-red-50", color: "text-red-600", valColor: "text-red-600" },
    { label: "Sensor aktif", value: screenhouses.length * 6, icon: Activity, bg: "bg-green-50", color: "text-green-700" },
  ];

  const sensors = [
    { label: "Nitrogen", icon: Leaf },
    { label: "Kelembapan", icon: Droplets },
    { label: "Phosphorus", icon: Activity },
    { label: "Potassium", icon: Activity },
    { label: "Suhu", icon: Thermometer },
    { label: "pH Tanah", icon: Activity },
  ];

  return (
    <div className="fixed inset-0 flex bg-slate-100 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        screenhouses={screenhouses}
        role={user.role}
        user={user}
        activeAlerts={activeAlerts}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* TOPBAR */}
        <header className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <Menu size={20} className="text-gray-500" />
            </button>
            <div>
              <div className="text-sm font-semibold text-gray-800">Dashboard petani</div>
              <div className="text-xs text-gray-400">Halo, {user.name} — pantau screenhouse kamu</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-50 text-green-800 text-xs font-medium px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Online
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* GREETING */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-gray-800">Selamat pagi, {user.name} 👋</div>
              <div className="text-sm text-gray-400 mt-0.5">Semua screenhouse dalam kondisi normal</div>
            </div>
            <div className="flex items-center gap-2.5 bg-green-50 rounded-xl px-4 py-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div>
                <div className="text-xs font-semibold text-green-800">Semua device online</div>
                <div className="text-xs text-green-600 mt-0.5">Monitoring berjalan normal</div>
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

          {/* SECTION TITLE */}
          <div>
            <div className="text-sm font-semibold text-gray-800">Screenhouse saya</div>
            <div className="text-xs text-gray-400 mt-0.5">Monitoring realtime seluruh screenhouse</div>
          </div>

          {/* SCREENHOUSE GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {screenhouses.map((sh) => (
              <div key={sh.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                {/* CARD HEADER */}
                <div className="px-4 py-3.5 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{sh.name}</div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={12} />{sh.village}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock3 size={12} />Update 14:32
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">Online</span>
                </div>

                {/* SENSOR GRID */}
                <div className="p-3 grid grid-cols-2 gap-2">
                  {sensors.map((sensor) => (
                    <div key={sensor.label} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">{sensor.label}</div>
                        <div className="text-base font-semibold text-gray-800 mt-1">
                          {sh[sensor.label.toLowerCase()] ?? "—"}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                        <sensor.icon size={15} className="text-green-700" />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

export default PetaniDashboard;