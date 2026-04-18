import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth";
import { getLanguageDir } from "@/lib/i18n";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import ForecastPage from "@/pages/ForecastPage";
import IngestionPage from "@/pages/IngestionPage";
import InventoryPage from "@/pages/InventoryPage";
import ColdChainPage from "@/pages/ColdChainPage";
import CoverageMapPage from "@/pages/CoverageMapPage";
import Dhis2ConfigPage from "@/pages/admin/Dhis2Config";
import OpenlmisConfigPage from "@/pages/admin/OpenlmisConfig";
import MsupplyConfigPage from "@/pages/admin/MsupplyConfig";
import ImpactReportPage from "@/pages/reports/ImpactReport";
import VisionDashboardPage from "@/pages/vision/VisionDashboardPage";
import VisionScanPage from "@/pages/vision/VisionScanPage";
import VisionEquipmentPage from "@/pages/vision/VisionEquipmentPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { init } = useAuthStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const dir = getLanguageDir(i18n.language);
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
        path="/reports/impact"
        element={
          <ProtectedRoute>
            <ImpactReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vision"
        element={
          <ProtectedRoute>
            <VisionDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vision/scan"
        element={
          <ProtectedRoute>
            <VisionScanPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vision/equipment"
        element={
          <ProtectedRoute>
            <VisionEquipmentPage />
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
      <Route
        path="/admin/openlmis"
        element={
          <ProtectedRoute>
            <OpenlmisConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/msupply"
        element={
          <ProtectedRoute>
            <MsupplyConfigPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
