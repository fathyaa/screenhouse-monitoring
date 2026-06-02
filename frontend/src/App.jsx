import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AlertProvider } from "./context/AlertContext";
import "./App.css";

import OperatorDashboard from "./pages/OperatorDashboard";
import ScreenhouseDetailPage from "./pages/ScreenhouseDetailPage";
import PetaniDashboard from "./pages/PetaniDashboard";
import NotifikasiPage from "./pages/NotifikasiPage";
import ApprovalPage from "./pages/ApprovalPage";
import FarmerScreenhousesPage from "./pages/FarmerScreenhousesPage";
import ThresholdPage from "./pages/ThresholdPage";
import KelolaUserPage from "./pages/KelolaUserPage";
import KelolaScreenhousePage from "./pages/KelolaScreenhousePage";
import KonfigurasiPage from "./pages/KonfigurasiPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterScreenhousePage from "./pages/RegisterScreenhousePage";

function PrivateRoute({ children, allowedRole, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const roles = allowedRoles || (allowedRole ? [allowedRole] : []);
  if (!token || !roles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}

const SUPER_ADMIN = ["super_admin"];
const OPERATOR = ["operator", "super_admin"];

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/screenhouse" element={<RegisterScreenhousePage />} />

      {/* PETANI */}
      <Route path="/petani" element={<PrivateRoute allowedRole="petani"><PetaniDashboard /></PrivateRoute>} />
      <Route path="/petani/screenhouse/:id" element={<PrivateRoute allowedRole="petani"><ScreenhouseDetailPage basePath="/petani" /></PrivateRoute>} />
      <Route path="/petani/notifikasi" element={<PrivateRoute allowedRole="petani"><NotifikasiPage /></PrivateRoute>} />

      {/* OPERATOR (+ super_admin) */}
      <Route path="/operator" element={<PrivateRoute allowedRoles={OPERATOR}><OperatorDashboard /></PrivateRoute>} />
      <Route path="/operator/screenhouse/:id" element={<PrivateRoute allowedRoles={OPERATOR}><ScreenhouseDetailPage basePath="/operator" /></PrivateRoute>} />
      <Route path="/operator/approval" element={<PrivateRoute allowedRoles={OPERATOR}><ApprovalPage /></PrivateRoute>} />
      <Route path="/operator/approval/petani/:userId" element={<PrivateRoute allowedRoles={OPERATOR}><FarmerScreenhousesPage /></PrivateRoute>} />

      {/* SUPER ADMIN */}
      <Route path="/admin/kelola-user" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KelolaUserPage /></PrivateRoute>} />
      <Route path="/admin/kelola-screenhouse" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KelolaScreenhousePage /></PrivateRoute>} />
      <Route path="/admin/kelola-threshold" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><ThresholdPage /></PrivateRoute>} />
      <Route path="/admin/konfigurasi" element={<PrivateRoute allowedRoles={SUPER_ADMIN}><KonfigurasiPage /></PrivateRoute>} />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <>
      <Toaster />
      <AlertProvider>
        <AppRoutes />
      </AlertProvider>
    </>
  );
}

export default App;
