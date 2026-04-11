import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import ForecastPage from "@/pages/ForecastPage";
import IngestionPage from "@/pages/IngestionPage";
import InventoryPage from "@/pages/InventoryPage";
import ColdChainPage from "@/pages/ColdChainPage";
import CoverageMapPage from "@/pages/CoverageMapPage";
import Dhis2ConfigPage from "@/pages/admin/Dhis2Config";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OverviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forecast"
        element={
          <ProtectedRoute>
            <ForecastPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ingestion"
        element={
          <ProtectedRoute>
            <IngestionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <InventoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cold-chain"
        element={
          <ProtectedRoute>
            <ColdChainPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coverage-map"
        element={
          <ProtectedRoute>
            <CoverageMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dhis2"
        element={
          <ProtectedRoute>
            <Dhis2ConfigPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
