import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

import { useEffect, useState } from "react";

function OperatorDashboard() {
  const [screenhouses, setScreenhouses] = useState([]);

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    fetch("http://localhost:3003/screenhouses")
      .then((res) => res.json())
      .then((data) => {
        setScreenhouses(data);
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (d) =>
    d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (d) =>
    d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="h-screen bg-[#f3f4f6] flex flex-col overflow-hidden">
      {/* HEADER */}

      <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-[1000]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-600 flex items-center justify-center text-white text-2xl shadow-md">
            🌱
          </div>

          <div>
            <h1 className="text-2xl font-bold text-green-700 leading-none">
              MCtan Monitoring
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Sistem Monitoring Screenhouse
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-gray-800">
            {formatTime(time)}
          </div>

          <div className="text-sm text-gray-500">{formatDate(time)}</div>
        </div>
      </header>

      {/* BODY */}

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}

        <aside className="w-[320px] min-w-[320px] bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          {/* RINGKASAN */}

          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xs font-bold tracking-[2px] uppercase text-gray-400 mb-5">
              Ringkasan
            </h2>

            <div className="space-y-4">
              <div className="bg-green-100 rounded-2xl p-5">
                <p className="text-sm text-green-700 mb-2">Total Screenhouse</p>

                <h3 className="text-4xl font-bold text-green-800">
                  {screenhouses.length}
                </h3>
              </div>

              <div className="bg-blue-100 rounded-2xl p-5">
                <p className="text-sm text-blue-700 mb-2">Device Online</p>

                <h3 className="text-4xl font-bold text-blue-800">
                  {screenhouses.length}
                </h3>
              </div>
            </div>
          </div>

          {/* STATUS */}

          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xs font-bold tracking-[2px] uppercase text-gray-400 mb-5">
              Status Sistem
            </h2>

            <div className="space-y-3">
              <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>

                <span className="text-sm font-medium text-gray-700">
                  Sistem realtime aktif
                </span>
              </div>

              <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>

                <span className="text-sm font-medium text-gray-700">
                  MQTT terhubung
                </span>
              </div>
            </div>
          </div>

          {/* LIST SCREENHOUSE */}

          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-xs font-bold tracking-[2px] uppercase text-gray-400 mb-5">
              Daftar Screenhouse
            </h2>

            <div className="space-y-4">
              {screenhouses.map((sh, index) => (
                <div
                  key={sh.id}
                  className="bg-gray-50 hover:bg-green-50 transition rounded-2xl p-4 cursor-pointer border border-transparent hover:border-green-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 leading-snug">
                        {sh.name}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        {[sh.village, sh.district].filter(Boolean).join(", ")}
                      </p>
                    </div>

                    <div className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
                      Aktif
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* MAP */}

        <div className="flex-1 relative">
          {/* TOPBAR */}

          <div className="absolute top-5 left-5 right-5 z-[1000]">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-6 py-4 flex items-center justify-between border border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Dashboard Operator
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Monitoring realtime screenhouse pembibitan padi
                </p>
              </div>

              <div className="bg-green-100 text-green-700 px-5 py-2 rounded-xl font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Online
              </div>
            </div>
          </div>

          {/* MAP CONTAINER */}

          <MapContainer
            center={[-6.9175, 106.9287]}
            zoom={10}
            className="h-full w-full"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {screenhouses.map((sh) => (
              <Marker key={sh.id} position={[sh.latitude, sh.longitude]}>
                <Popup>
                  <div className="min-w-[200px]">
                    <h3 className="text-lg font-bold text-green-700">
                      {sh.name}
                    </h3>

                    {sh.owner_name && (
                      <p className="text-sm text-gray-600 mt-2">
                        👤 {sh.owner_name}
                      </p>
                    )}

                    <p className="text-sm text-gray-600 mt-1">
                      📍 {[sh.village, sh.district].filter(Boolean).join(", ")}
                    </p>

                    <div className="mt-4 bg-green-100 text-green-700 rounded-xl py-2 text-center font-semibold text-sm">
                      Device Online
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default OperatorDashboard;
