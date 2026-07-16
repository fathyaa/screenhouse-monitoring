import { Routes, Route, Navigate, useParams } from "react-router-dom";
import AppToaster from "./components/AppToaster";
import { isTokenValid, clearSession } from "./utils/auth";
import { AlertProvider } from "./context/AlertContext";
import { PushNotificationProvider } from "./context/PushNotificationContext";
import { ScreenhouseStatsProvider } from "./context/ScreenhouseStatsContext";
import "./App.css";

import OperatorDashboard from "./pages/OperatorDashboard";
import OperatorLaporanPage from "./pages/OperatorLaporanPage";
import ScreenhouseDetailPage from "./pages/ScreenhouseDetailPage";
import PetaniDashboard from "./pages/PetaniDashboard";
import PetaniRiwayatSemaiPage from "./pages/PetaniRiwayatSemaiPage";
import SemaiCycleDetailPage from "./pages/SemaiCycleDetailPage";
import NotifikasiPage from "./pages/NotifikasiPage";
import ApprovalPage from "./pages/ApprovalPage";
import DaftarPetaniPage from "./pages/DaftarPetaniPage";
import FarmerScreenhousesPage from "./pages/FarmerScreenhousesPage";
import ThresholdPage from "./pages/ThresholdPage";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import KelolaUserPage from "./pages/KelolaUserPage";
import KelolaScreenhousePage from "./pages/KelolaScreenhousePage";
import KonfigurasiPage from "./pages/KonfigurasiPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterScreenhousePage from "./pages/RegisterScreenhousePage";
import PetaniAjukanScreenhousePage from "./pages/PetaniAjukanScreenhousePage";
import PengaturanAkunPage from "./pages/PengaturanAkunPage";

function PrivateRoute({ children, allowedRole, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const roles = allowedRoles || (allowedRole ? [allowedRole] : []);

  // Token kadaluarsa/rusak: bersihkan sesi basi lalu paksa login ulang
  // sebelum halaman sempat render dan menembak API yang pasti 401.
  if (token && !isTokenValid(token)) {
    clearSession();
    return <Navigate to="/login" replace />;
  }

  if (!token || !roles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}

const SUPER_ADMIN = ["super_admin"];
const OPERATOR = ["operator", "super_admin"];

function RedirectLegacyFarmerPath() {
  const { userId } = useParams();
  return <Navigate to={`/operator/petani/${userId}`} replace />;
}

function AppRoutes() {
  return (
    <>
      <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/screenhouse" element={<RegisterScreenhousePage />} />

      {/* PETANI */}
      <Route path="/petani" element={<PrivateRoute allowedRole="petani"><PetaniDashboard /></PrivateRoute>} />
      <Route path="/petani/riwayat-semai" element={<PrivateRoute allowedRole="petani"><PetaniRiwayatSemaiPage /></PrivateRoute>} />
      <Route path="/petani/riwayat-semai/:screenhouseId/:cycleId" element={<PrivateRoute allowedRole="petani"><SemaiCycleDetailPage /></PrivateRoute>} />
      <Route path="/petani/tren" element={<Navigate to="/petani" replace />} />
      <Route path="/petani/screenhouse/:id" element={<PrivateRoute allowedRole="petani"><ScreenhouseDetailPage basePath="/petani" /></PrivateRoute>} />
      <Route path="/petani/ajukan-screenhouse" element={<PrivateRoute allowedRole="petani"><PetaniAjukanScreenhousePage /></PrivateRoute>} />
      <Route path="/petani/peringatan" element={<PrivateRoute allowedRole="petani"><NotifikasiPage /></PrivateRoute>} />
      <Route path="/petani/pengaturan" element={<PrivateRoute allowedRole="petani"><PengaturanAkunPage /></PrivateRoute>} />
      <Route path="/petani/notifikasi" element={<Navigate to="/petani/peringatan" replace />} />

      {/* OPERATOR (+ super_admin) */}
      <Route path="/operator" element={<PrivateRoute allowedRoles={OPERATOR}><OperatorDashboard /></PrivateRoute>} />
      <Route path="/operator/laporan" element={<PrivateRoute allowedRoles={OPERATOR}><OperatorLaporanPage /></PrivateRoute>} />
      <Route path="/operator/tren" element={<Navigate to="/operator" replace />} />
      <Route path="/operator/screenhouse/:id" element={<PrivateRoute allowedRoles={OPERATOR}><ScreenhouseDetailPage basePath="/operator" /></PrivateRoute>} />
      <Route path="/operator/approval" element={<PrivateRoute allowedRoles={OPERATOR}><ApprovalPage /></PrivateRoute>} />
      <Route path="/operator/petani" element={<PrivateRoute allowedRoles={OPERATOR}><DaftarPetaniPage /></PrivateRoute>} />
      <Route path="/operator/petani/:userId" element={<PrivateRoute allowedRoles={OPERATOR}><FarmerScreenhousesPage /></PrivateRoute>} />
      <Route path="/operator/pengaturan" element={<PrivateRoute allowedRoles={OPERATOR}><PengaturanAkunPage /></PrivateRoute>} />
      <Route path="/operator/approval/petani/:userId" element={<RedirectLegacyFarmerPath />} />

      {/* SUPER ADMIN */}
      <Route path="/admin" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><AdminOverviewPage /></PrivateRoute>} />
      <Route path="/admin/kelola-user" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KelolaUserPage /></PrivateRoute>} />
      <Route path="/admin/kelola-screenhouse" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KelolaScreenhousePage /></PrivateRoute>} />
      <Route path="/admin/kelola-threshold" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><ThresholdPage /></PrivateRoute>} />
      <Route path="/admin/konfigurasi" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KonfigurasiPage /></PrivateRoute>} />
      <Route path="/admin/pengaturan" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><PengaturanAkunPage /></PrivateRoute>} />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <>
      <AppToaster />
      <PushNotificationProvider>
        <AlertProvider>
          <ScreenhouseStatsProvider>
            <AppRoutes />
          </ScreenhouseStatsProvider>
        </AlertProvider>
      </PushNotificationProvider>
    </>
  );
}

export default App;
