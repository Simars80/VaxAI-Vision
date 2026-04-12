/**
 * Comprehensive mock data for demo mode.
 * When the app runs with ?demo=true (no backend), every API call is intercepted
 * and served from this file so the dashboard looks fully populated.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

// ── Ingestion Jobs ───────────────────────────────────────────────────────────

const MOCK_INGESTION_JOBS = [
  { id: "job-001", source: "csv", status: "completed", file_name: "nigeria_stock_q1.csv", rows_total: 2480, rows_succeeded: 2475, rows_failed: 5, created_at: hoursAgo(2), completed_at: hoursAgo(1.5) },
  { id: "job-002", source: "csv", status: "completed", file_name: "kenya_vaccines_mar.csv", rows_total: 1120, rows_succeeded: 1120, rows_failed: 0, created_at: hoursAgo(6), completed_at: hoursAgo(5) },
  { id: "job-003", source: "dhis2", status: "completed", file_name: null, rows_total: 4200, rows_succeeded: 4198, rows_failed: 2, created_at: hoursAgo(12), completed_at: hoursAgo(11) },
  { id: "job-004", source: "csv", status: "completed", file_name: "ghana_cold_chain.csv", rows_total: 890, rows_succeeded: 890, rows_failed: 0, created_at: daysAgo(1), completed_at: daysAgo(0.9) },
  { id: "job-005", source: "openlmis", status: "completed", file_name: null, rows_total: 3100, rows_succeeded: 3094, rows_failed: 6, created_at: daysAgo(2), completed_at: daysAgo(1.8) },
  { id: "job-006", source: "csv", status: "failed", file_name: "bad_format_test.csv", rows_total: 50, rows_succeeded: 0, rows_failed: 50, created_at: daysAgo(3), completed_at: daysAgo(3) },
  { id: "job-007", source: "csv", status: "completed", file_name: "senegal_inventory.csv", rows_total: 620, rows_succeeded: 618, rows_failed: 2, created_at: daysAgo(4), completed_at: daysAgo(3.9) },
  { id: "job-008", source: "dhis2", status: "completed", file_name: null, rows_total: 5600, rows_succeeded: 5600, rows_failed: 0, created_at: daysAgo(5), completed_at: daysAgo(4.8) },
  { id: "job-009", source: "csv", status: "completed", file_name: "ethiopia_coverage.csv", rows_total: 1500, rows_succeeded: 1497, rows_failed: 3, created_at: daysAgo(6), completed_at: daysAgo(5.9) },
  { id: "job-010", source: "msupply", status: "completed", file_name: null, rows_total: 2200, rows_succeeded: 2200, rows_failed: 0, created_at: daysAgo(7), completed_at: daysAgo(6.8) },
];

// ── Model Runs ───────────────────────────────────────────────────────────────

const MOCK_MODEL_RUNS = [
  { id: "run-001", supply_item_id: "bcg-vaccine-001", facility_id: "FAC-001", status: "completed", mlflow_run_id: "mlf-abc123", metrics: { mae: 12.4, rmse: 18.7, mape: 0.08 }, error_message: null, created_at: hoursAgo(4), completed_at: hoursAgo(3) },
  { id: "run-002", supply_item_id: "opv-vaccine-002", facility_id: "FAC-002", status: "completed", mlflow_run_id: "mlf-def456", metrics: { mae: 8.1, rmse: 11.3, mape: 0.05 }, error_message: null, created_at: daysAgo(1), completed_at: daysAgo(0.9) },
  { id: "run-003", supply_item_id: "penta-vaccine-003", facility_id: null, status: "completed", mlflow_run_id: "mlf-ghi789", metrics: { mae: 15.9, rmse: 22.1, mape: 0.11 }, error_message: null, created_at: daysAgo(2), completed_at: daysAgo(1.8) },
  { id: "run-004", supply_item_id: "measles-vaccine-004", facility_id: "FAC-003", status: "running", mlflow_run_id: null, metrics: null, error_message: null, created_at: hoursAgo(1), completed_at: null },
  { id: "run-005", supply_item_id: "yf-vaccine-005", facility_id: "FAC-001", status: "completed", mlflow_run_id: "mlf-jkl012", metrics: { mae: 6.2, rmse: 9.8, mape: 0.04 }, error_message: null, created_at: daysAgo(3), completed_at: daysAgo(2.9) },
];

// ── Inventory / Stock Levels ────────────────────────────────────────────────

const MOCK_STOCK_LEVELS = {
  total_facilities: 6,
  total_vaccines: 8,
  critical_count: 4,
  low_count: 6,
  adequate_count: 22,
  facilities: [
    {
      facility_id: "FAC-001",
      facility_name: "Lagos Central Vaccine Store",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 4200, status: "adequate" },
        { supply_item_id: "v2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 1800, status: "adequate" },
        { supply_item_id: "v3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 3100, status: "adequate" },
        { supply_item_id: "v4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 2400, status: "adequate" },
        { supply_item_id: "v5", name: "Yellow Fever", category: "vaccine", unit_of_measure: "doses", current_stock: 890, status: "adequate" },
        { supply_item_id: "v6", name: "PCV-13 (Pneumococcal)", category: "vaccine", unit_of_measure: "doses", current_stock: 1500, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-002",
      facility_name: "Kano General Hospital",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 320, status: "adequate" },
        { supply_item_id: "v2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 45, status: "low" },
        { supply_item_id: "v3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 8, status: "critical" },
        { supply_item_id: "v4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 180, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-003",
      facility_name: "Nairobi Central Clinic",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 560, status: "adequate" },
        { supply_item_id: "v2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 28, status: "low" },
        { supply_item_id: "v3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 210, status: "adequate" },
        { supply_item_id: "v6", name: "PCV-13 (Pneumococcal)", category: "vaccine", unit_of_measure: "doses", current_stock: 15, status: "low" },
      ],
    },
    {
      facility_id: "FAC-004",
      facility_name: "Accra Regional Store",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 720, status: "adequate" },
        { supply_item_id: "v2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 380, status: "adequate" },
        { supply_item_id: "v4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 5, status: "critical" },
        { supply_item_id: "v5", name: "Yellow Fever", category: "vaccine", unit_of_measure: "doses", current_stock: 42, status: "low" },
      ],
    },
    {
      facility_id: "FAC-005",
      facility_name: "Abuja Health Centre",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 150, status: "adequate" },
        { supply_item_id: "v3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 3, status: "critical" },
        { supply_item_id: "v4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 95, status: "adequate" },
        { supply_item_id: "v6", name: "PCV-13 (Pneumococcal)", category: "vaccine", unit_of_measure: "doses", current_stock: 220, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-006",
      facility_name: "Dakar District Pharmacy",
      items: [
        { supply_item_id: "v1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 88, status: "adequate" },
        { supply_item_id: "v2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 12, status: "low" },
        { supply_item_id: "v5", name: "Yellow Fever", category: "vaccine", unit_of_measure: "doses", current_stock: 4, status: "critical" },
        { supply_item_id: "v7", name: "Rotavirus", category: "vaccine", unit_of_measure: "doses", current_stock: 35, status: "low" },
      ],
    },
  ],
};

// ── Cold Chain ───────────────────────────────────────────────────────────────

const COLD_CHAIN_FACILITIES = [
  { id: "cc-fac-001", name: "Lagos Central Vaccine Store", country: "Nigeria" },
  { id: "cc-fac-002", name: "Kano General Hospital", country: "Nigeria" },
  { id: "cc-fac-003", name: "Nairobi Central Clinic", country: "Kenya" },
  { id: "cc-fac-004", name: "Accra Regional Store", country: "Ghana" },
  { id: "cc-fac-005", name: "Abuja Health Centre", country: "Nigeria" },
];

function generateReadings(): { readings: Array<{ facility_id: string; sensor_id: string; timestamp: string; temp_celsius: number; status: string }> } {
  const readings: Array<{ facility_id: string; sensor_id: string; timestamp: string; temp_celsius: number; status: string }> = [];
  const now = Date.now();
  for (const fac of COLD_CHAIN_FACILITIES) {
    for (let i = 0; i < 36; i++) {
      const baseTemp = 4.0 + (fac.id === "cc-fac-002" ? 2.5 : 0);
      const temp = baseTemp + (Math.random() - 0.5) * 3;
      const status = temp < 2 ? "breach" : temp > 8 ? "breach" : temp < 2.5 || temp > 7.5 ? "warning" : "normal";
      readings.push({
        facility_id: fac.id,
        sensor_id: `${fac.id}-sensor-01`,
        timestamp: new Date(now - i * 5 * 60_000).toISOString(),
        temp_celsius: Math.round(temp * 10) / 10,
        status,
      });
    }
  }
  return { readings };
}

const COLD_CHAIN_ALERTS = {
  alerts: [
    { id: "alert-001", facility_id: "cc-fac-002", facility_name: "Kano General Hospital", country: "Nigeria", sensor_id: "cc-fac-002-sensor-01", alert_type: "high", peak_temp_celsius: 9.2, threshold_celsius: 8.0, start_time: hoursAgo(3), end_time: hoursAgo(2), resolved: true, severity: "warning" },
    { id: "alert-002", facility_id: "cc-fac-002", facility_name: "Kano General Hospital", country: "Nigeria", sensor_id: "cc-fac-002-sensor-01", alert_type: "high", peak_temp_celsius: 10.1, threshold_celsius: 8.0, start_time: hoursAgo(1), end_time: null, resolved: false, severity: "critical" },
    { id: "alert-003", facility_id: "cc-fac-004", facility_name: "Accra Regional Store", country: "Ghana", sensor_id: "cc-fac-004-sensor-01", alert_type: "low", peak_temp_celsius: 1.2, threshold_celsius: 2.0, start_time: daysAgo(2), end_time: daysAgo(1.9), resolved: true, severity: "warning" },
  ],
  total: 3,
  active: 1,
};

// ── Coverage / Geospatial ───────────────────────────────────────────────────

const MOCK_COVERAGE_FACILITIES = [
  { id: "cov-001", name: "Lagos Central Vaccine Store", country: "Nigeria", region: "Lagos", lat: 6.4541, lng: 3.3947, coverageRate: 83, stockStatus: "adequate", vaccineType: "bOPV", period: "2025-Q1", dosesAdministered: 125000, targetPopulation: 150000 },
  { id: "cov-002", name: "Kano General Hospital", country: "Nigeria", region: "Kano", lat: 12.0022, lng: 8.5920, coverageRate: 67, stockStatus: "low", vaccineType: "PENTA", period: "2025-Q1", dosesAdministered: 80400, targetPopulation: 120000 },
  { id: "cov-003", name: "Abuja Health Centre", country: "Nigeria", region: "FCT", lat: 9.0579, lng: 7.4951, coverageRate: 91, stockStatus: "adequate", vaccineType: "PCV13", period: "2025-Q1", dosesAdministered: 54600, targetPopulation: 60000 },
  { id: "cov-004", name: "Nairobi Central Clinic", country: "Kenya", region: "Nairobi", lat: -1.2864, lng: 36.8172, coverageRate: 88, stockStatus: "adequate", vaccineType: "Measles", period: "2025-Q1", dosesAdministered: 70400, targetPopulation: 80000 },
  { id: "cov-005", name: "Kisumu District Hospital", country: "Kenya", region: "Kisumu", lat: -0.1022, lng: 34.7617, coverageRate: 72, stockStatus: "low", vaccineType: "BCG", period: "2025-Q1", dosesAdministered: 36000, targetPopulation: 50000 },
  { id: "cov-006", name: "Mombasa Health Post", country: "Kenya", region: "Mombasa", lat: -4.0435, lng: 39.6682, coverageRate: 79, stockStatus: "adequate", vaccineType: "bOPV", period: "2025-Q1", dosesAdministered: 39500, targetPopulation: 50000 },
  { id: "cov-007", name: "Accra Regional Store", country: "Ghana", region: "Greater Accra", lat: 5.6037, lng: -0.1870, coverageRate: 94, stockStatus: "adequate", vaccineType: "YF", period: "2025-Q1", dosesAdministered: 47000, targetPopulation: 50000 },
  { id: "cov-008", name: "Kumasi Teaching Hospital", country: "Ghana", region: "Ashanti", lat: 6.6885, lng: -1.6244, coverageRate: 86, stockStatus: "adequate", vaccineType: "PENTA", period: "2025-Q1", dosesAdministered: 43000, targetPopulation: 50000 },
  { id: "cov-009", name: "Dakar Central Pharmacy", country: "Senegal", region: "Dakar", lat: 14.7167, lng: -17.4677, coverageRate: 76, stockStatus: "low", vaccineType: "Measles", period: "2025-Q1", dosesAdministered: 38000, targetPopulation: 50000 },
  { id: "cov-010", name: "Ibadan District Clinic", country: "Nigeria", region: "Oyo", lat: 7.3775, lng: 3.9470, coverageRate: 71, stockStatus: "critical", vaccineType: "BCG", period: "2025-Q1", dosesAdministered: 28400, targetPopulation: 40000 },
  { id: "cov-011", name: "Addis Ababa Health Bureau", country: "Ethiopia", region: "Addis Ababa", lat: 9.0250, lng: 38.7469, coverageRate: 81, stockStatus: "adequate", vaccineType: "PCV13", period: "2025-Q1", dosesAdministered: 56700, targetPopulation: 70000 },
  { id: "cov-012", name: "Kampala Regional Hub", country: "Uganda", region: "Central", lat: 0.3476, lng: 32.5825, coverageRate: 77, stockStatus: "adequate", vaccineType: "bOPV", period: "2025-Q1", dosesAdministered: 46200, targetPopulation: 60000 },
];

// ── Forecasting ──────────────────────────────────────────────────────────────

function generateForecast(supplyItemId: string): {
  supply_item_id: string;
  facility_id: string | null;
  model_run_id: string;
  predictions: Array<{ forecast_date: string; yhat: number; yhat_lower: number; yhat_upper: number; model_source: string | null }>;
} {
  const predictions = [];
  const baseValue = 800 + Math.abs(hashCode(supplyItemId)) % 600;
  for (let i = 1; i <= 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const trend = baseValue + i * 15 + (Math.random() - 0.3) * 80;
    predictions.push({
      forecast_date: date.toISOString().split("T")[0],
      yhat: Math.round(trend),
      yhat_lower: Math.round(trend * 0.82),
      yhat_upper: Math.round(trend * 1.18),
      model_source: "prophet",
    });
  }
  return {
    supply_item_id: supplyItemId,
    facility_id: null,
    model_run_id: "run-demo-001",
    predictions,
  };
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ── Vision ───────────────────────────────────────────────────────────────────

function getVisionMock(url: string) {
  if (url.includes("/vision/scans/history")) {
    const stages = ["stage_1", "stage_2", "stage_1", "stage_3", "stage_1", "stage_2", "stage_4", "stage_1", "stage_2", "stage_1"] as const;
    return {
      scans: stages.map((stage, i) => ({
        id: `demo-scan-${i}`,
        facility_id: `facility-${(i % 5) + 1}`,
        facility_name: ["Kano General Hospital", "Lagos Central Clinic", "Abuja Health Centre", "Ibadan District", "Kaduna Primary"][i % 5],
        classification: stage,
        confidence: [0.94, 0.87, 0.91, 0.78, 0.96, 0.89, 0.72, 0.93, 0.85, 0.97][i],
        usable: stage === "stage_1" || stage === "stage_2",
        scan_type: "vvm",
        scanned_at: new Date(Date.now() - i * 3600000 * 4).toISOString(),
      })),
      total: 10,
    };
  }

  if (url.includes("/vision/models/status")) {
    return {
      models: [
        { name: "VVM Classifier", version: "0.1.0-placeholder", loaded: true, backend: "cpu" },
        { name: "Equipment Inspector", version: "0.1.0-placeholder", loaded: true, backend: "placeholder" },
      ],
    };
  }

  if (url.includes("/vision/vvm/scan")) {
    const stages = ["stage_1", "stage_2", "stage_3", "stage_4"] as const;
    const idx = Math.floor(Math.random() * 4);
    return {
      result: {
        classification: stages[idx],
        confidence: 0.75 + Math.random() * 0.2,
        image_hash: Math.random().toString(36).slice(2, 18),
        usable: idx < 2,
      },
      model_version: "0.1.0-placeholder",
    };
  }

  if (url.includes("/vision/equipment/inspect")) {
    return {
      result: {
        status: "operational",
        details: "No visible damage detected. Equipment appears to be in working condition.",
        image_hash: Math.random().toString(36).slice(2, 18),
      },
      model_version: "0.1.0-placeholder",
    };
  }

  return undefined;
}

// ── DHIS2 Config ─────────────────────────────────────────────────────────────

const MOCK_DHIS2_STATUS = {
  configured: true,
  base_url: "https://play.dhis2.org/40.4.0",
  last_sync: hoursAgo(6),
  datasets_available: 12,
  org_units_mapped: 48,
};

// ── Main Router ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMockResponse(url: string, _params?: any): any {
  // Ingestion jobs
  if (url.includes("/ingestion/jobs")) {
    return MOCK_INGESTION_JOBS;
  }

  // Inventory / stock levels
  if (url.includes("/inventory/stock-levels")) {
    return MOCK_STOCK_LEVELS;
  }

  // Forecasting - model runs
  if (url.includes("/forecasting/runs")) {
    return MOCK_MODEL_RUNS;
  }

  // Forecasting - predict
  if (url.includes("/forecasting/predict/")) {
    const parts = url.split("/");
    const itemId = parts[parts.length - 1] || "default-item";
    return generateForecast(itemId);
  }

  // Forecasting - train
  if (url.includes("/forecasting/train")) {
    return {
      id: "run-demo-new",
      supply_item_id: "demo-item",
      facility_id: null,
      status: "queued",
      mlflow_run_id: null,
      metrics: null,
      error_message: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
  }

  // Cold chain - facilities
  if (url.includes("/cold-chain/facilities")) {
    return { facilities: COLD_CHAIN_FACILITIES };
  }

  // Cold chain - readings
  if (url.includes("/cold-chain/readings")) {
    return generateReadings();
  }

  // Cold chain - alerts
  if (url.includes("/cold-chain/alerts")) {
    return COLD_CHAIN_ALERTS;
  }

  // Coverage / geospatial facilities
  if (url.includes("/coverage/facilities")) {
    return MOCK_COVERAGE_FACILITIES;
  }

  // Reports / impact
  if (url.includes("/reports/impact")) {
    return {
      generatedAt: new Date().toISOString(),
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
      coverageByCountry: [
        { country: "Nigeria", facilityCount: 420, avgCoverageRate: 78, totalDosesAdministered: 1_240_000 },
        { country: "Kenya", facilityCount: 310, avgCoverageRate: 84, totalDosesAdministered: 680_000 },
        { country: "Ghana", facilityCount: 180, avgCoverageRate: 91, totalDosesAdministered: 320_000 },
        { country: "Senegal", facilityCount: 145, avgCoverageRate: 72, totalDosesAdministered: 190_000 },
      ],
      stockSummary: [
        { status: "Adequate", facilityCount: 780 },
        { status: "Low", facilityCount: 210 },
        { status: "Stockout", facilityCount: 65 },
      ],
      coldChain: { totalReadings: 48000, breachCount: 320, complianceRate: 99, totalAlerts: 142, resolvedAlerts: 138 },
      wastage: { totalWastageQty: 24500, totalIssuedQty: 2430000, wastageRate: 1.01 },
      facilityPerformance: [
        { id: "f1", name: "Lagos Hub", region: "Lagos", country: "Nigeria", vaccineType: "bOPV", dosesAdministered: 125000, targetPopulation: 150000, coverageRate: 83, stockStatus: "Adequate", current: 4200 },
        { id: "f2", name: "Kano Facility", region: "Kano", country: "Nigeria", vaccineType: "PENTA", dosesAdministered: 98000, targetPopulation: 120000, coverageRate: 82, stockStatus: "Low", current: 980 },
        { id: "f3", name: "Nairobi Store", region: "Nairobi", country: "Kenya", vaccineType: "PCV13", dosesAdministered: 67000, targetPopulation: 80000, coverageRate: 84, stockStatus: "Adequate", current: 3100 },
      ],
    };
  }

  // DHIS2 config status
  if (url.includes("/dhis2/status") || url.includes("/dhis2/config")) {
    return MOCK_DHIS2_STATUS;
  }

  // Vision endpoints
  const visionMock = getVisionMock(url);
  if (visionMock !== undefined) return visionMock;

  // Fallback: return empty array for unknown list endpoints, empty object otherwise
  return [];
}
