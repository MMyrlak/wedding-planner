import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Guests } from "./pages/Guests";
import { Tables } from "./pages/Tables";
import { Reports } from "./pages/Reports";
import { Budget } from "./pages/Budget";
import { Checklist } from "./pages/Checklist";
import { Timeline } from "./pages/Timeline";
import { Vendors } from "./pages/Vendors";
import { PublicRsvp } from "./pages/PublicRsvp";
import { AdminPanel } from "./pages/AdminPanel";
import { WeddingSettings } from "./pages/WeddingSettings";

export default function App() {
  return (
    <Routes>
      {/* Logowanie i Rejestracja */}
      <Route path="/login" element={<Login />} />

      {/* Publiczny formularz RSVP z tokenem */}
      <Route path="/rsvp/:token" element={<PublicRsvp />} />

      {/* Chroniony panel aplikacji */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="guests" element={<Guests />} />
        <Route path="tables" element={<Tables />} />
        <Route path="reports" element={<Reports />} />
        <Route path="budget" element={<Budget />} />
        <Route path="checklist" element={<Checklist />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="settings" element={<WeddingSettings />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>

      {/* Przekierowanie nieznanych ścieżek */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}