import { Settings, Database, Radio, Shield } from "lucide-react";
import AdminPageShell from "../components/AdminPageShell";
import { THRESHOLD_METRICS, DEFAULT_THRESHOLD } from "../constants/thresholdMetrics";
import { API_URL, MONITORING_URL } from "../config/api";

export default function KonfigurasiPage() {
  return (
    <AdminPageShell
      title="Konfigurasi Sistem"
      subtitle="Informasi sistem dan nilai batas aman bawaan"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-left">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-bl-primary" />
            <h3 className="text-sm font-semibold text-gray-800">Informasi Aplikasi</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 font-medium">Nama sistem</dt>
              <dd className="font-medium text-gray-800 text-right">BibitLive</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 font-medium">App Service (REST)</dt>
              <dd className="font-mono text-xs text-gray-700">{API_URL}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 font-medium">Monitoring (WebSocket)</dt>
              <dd className="font-mono text-xs text-gray-700">{MONITORING_URL}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 font-medium">Realtime</dt>
              <dd className="text-bl-primary font-medium">WebSocket + MQTT</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-left">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-bl-primary" />
            <h3 className="text-sm font-semibold text-gray-800">Akses & Peran</h3>
          </div>
          <ul className="text-sm text-gray-600 space-y-2">
            <li><span className="font-medium text-gray-800">Super Admin</span>: kelola pengguna, screenhouse, batas aman</li>
            <li><span className="font-medium text-gray-800">Operator</span>: persetujuan petani, pantau screenhouse</li>
            <li><span className="font-medium text-gray-800">Petani</span>: pantau screenhouse milik sendiri</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4 text-left lg:col-span-2">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-bl-primary" />
            <h3 className="text-sm font-semibold text-gray-800">Batas aman bawaan (referensi)</h3>
          </div>
          <p className="text-xs text-gray-600 font-medium">
            Nilai bawaan berikut dipakai saat screenhouse belum punya batas aman tersimpan.
            Atur per screenhouse di menu Kelola batas aman.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {THRESHOLD_METRICS.map((m) => (
              <div key={m.key} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <div className="text-xs font-medium text-gray-700">{m.label}</div>
                <div className="text-xs text-gray-600 font-medium mt-0.5">
                  {DEFAULT_THRESHOLD[m.minCol]}–{DEFAULT_THRESHOLD[m.maxCol]} {m.unit}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-left lg:col-span-2">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-bl-primary" />
            <h3 className="text-sm font-semibold text-gray-800">Sensor dan peringatan</h3>
          </div>
          <p className="text-sm text-gray-600">
            Peringatan otomatis dikirim saat nilai sensor melewati batas aman screenhouse terkait.
            Interval pengiriman data diatur di alat pengukur di lokasi.
          </p>
        </div>
      </div>
    </AdminPageShell>
  );
}
