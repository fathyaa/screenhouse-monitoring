import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import OperatorDashboard from "./pages/OperatorDashboard";
import PetaniDashboard from "./pages/PetaniDashboard";
import NotifikasiPage from "./pages/NotifikasiPage";
import ApprovalPage from "./pages/ApprovalPage";
import ThresholdPage from "./pages/ThresholdPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function App() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return (
    <Routes>

      {/* PUBLIC */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* PETANI */}
      <Route path="/petani" element={token && role === "petani" ? (<PetaniDashboard />) : (<Navigate to="/login" />)} />
      <Route path="/petani/notifikasi" element={token && role === "petani" ? (<NotifikasiPage />) : (<Navigate to="/login" />)} />

      {/* OPERATOR */}
      <Route path="/operator" element={token && role === "operator" ? (<OperatorDashboard />) : (<Navigate to="/login" />)} />
      <Route path="/operator/approval" element={token && role === "operator" ? (<ApprovalPage />) : (<Navigate to="/login" />)} />

      {/* ADMIN */}
      <Route path="/admin/kelola-user" element={token && role === "admin" ? (<KelolaUserPage />) : (<Navigate to="/login" />)} />
      <Route path="/admin/kelola-threshold" element={token && role === "admin" ? (<ThresholdPage />) : (<Navigate to="/login" />)} />
      <Route path="/admin/konfigurasi" element={token && role === "admin" ? (<KonfigurasiPage />) : (<Navigate to="/login" />)} />

    </Routes>
  );
}

export default App;
