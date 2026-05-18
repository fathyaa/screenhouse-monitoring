import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AlertProvider } from "./context/AlertContext";
import "./App.css";

import OperatorDashboard from "./pages/OperatorDashboard";
import PetaniDashboard from "./pages/PetaniDashboard";
import NotifikasiPage from "./pages/NotifikasiPage";
import ApprovalPage from "./pages/ApprovalPage";
import ThresholdPage from "./pages/ThresholdPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
// import KelolaUserPage from "./pages/KelolaUserPage";
// import KonfigurasiPage from "./pages/KonfigurasiPage";

function PrivateRoute({ children, allowedRole }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token || role !== allowedRole) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* PETANI */}
      <Route path="/petani" element={<PrivateRoute allowedRole="petani"><PetaniDashboard /></PrivateRoute>} />
      <Route path="/petani/notifikasi" element={<PrivateRoute allowedRole="petani"><NotifikasiPage /></PrivateRoute>} />

      {/* OPERATOR */}
      <Route path="/operator" element={<PrivateRoute allowedRole="operator"><OperatorDashboard /></PrivateRoute>} />
      <Route path="/operator/approval" element={<PrivateRoute allowedRole="operator"><ApprovalPage /></PrivateRoute>} />

      {/* ADMIN */}
      {/* <Route path="/admin/kelola-user" element={<PrivateRoute allowedRole="admin"><KelolaUserPage /></PrivateRoute>} /> */}
      <Route path="/admin/kelola-threshold" element={<PrivateRoute allowedRole="admin"><ThresholdPage /></PrivateRoute>} />
      {/* <Route path="/admin/konfigurasi" element={<PrivateRoute allowedRole="admin"><KonfigurasiPage /></PrivateRoute>} /> */}

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  const token = localStorage.getItem("token");
  return (
    <>
      <Toaster />
      {token ? (
        <AlertProvider>
          <AppRoutes />
        </AlertProvider>
      ) : (
        <AppRoutes />
      )}
    </>
  );
}

export default App;