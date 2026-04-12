import { apiClient, isDemoMode } from "./client";

/* ── Types ─────────────────────────────────────────────── */

export interface CoverageByCountry {
  country: string;
  facilityCount: number;
  avgCoverageRate: number;
  totalDosesAdministered: number;
}

export interface StockSummary {
  status: string;
  facilityCount: number;
}

export interface ColdChainSummary {
  totalReadings: number;
  breachCount: number;
  complianceRate: number;
  totalAlerts: number;
  resolvedAlerts: number;
}

export interface WastageSummary {
  totalWastageQty: number;
  totalIssuedQty: number;
  wastageRate: number;
}

export interface FacilityPerformance {
  id: string;
  name: string;
  region: string;
  country: string;
  vaccineType: string;
  dosesAdministered: number;
  targetPopulation: number;
  coverageRate: number;
  stockStatus: string;
  current: number;
}

export interface ImpactReportData {
  generatedAt: string;
  dateFrom?: string;
  dateTo?: string;
  coverageByCountry: CoverageByCountry[];
  stockSummary: StockSummary[];
  coldChain: ColdChainSummary;
  wastage: WastageSummary;
  facilityPerformance: FacilityPerformance[];
}

export interface ReportParams {
  dateFrom?: string;
  dateTo?: string;
  country?: string;
}

/* ── Demo / mock data ──────────────────────────────────── */

const MOCK_REPORT: ImpactReportData = {
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
  coldChain: {
    totalReadings: 48_000,
    breachCount: 320,
    complianceRate: 99,
    totalAlerts: 142,
    resolvedAlerts: 138,
  },
  wastage: {
    totalWastageQty: 24_500,
    totalIssuedQty: 2_430_000,
    wastageRate: 1.01,
  },
  facilityPerformance: [
    { id: "f1", name: "Lagos Hub", region: "Lagos", country: "Nigeria", vaccineType: "bOPV", dosesAdministered: 125_000, targetPopulation: 150_000, coverageRate: 83, stockStatus: "Adequate", current: 4200 },
    { id: "f2", name: "Kano Facility", region: "Kano", country: "Nigeria", vaccineType: "PENTA", dosesAdministered: 98_000, targetPopulation: 120_000, coverageRate: 82, stockStatus: "Low", current: 980 },
    { id: "f3", name: "Nairobi Store", region: "Nairobi", country: "Kenya", vaccineType: "PCV13", dosesAdministered: 67_000, targetPopulation: 80_000, coverageRate: 84, stockStatus: "Adequate", current: 3100 },
  ],
};

/* ── API functions ─────────────────────────────────────── */

export async function getImpactReport(params?: ReportParams): Promise<ImpactReportData> {
  if (isDemoMode()) return MOCK_REPORT;
  const { data } = await apiClient.get<ImpactReportData>("/reports/impact", { params });
  return data;
}

export function getImpactReportCsvUrl(params?: ReportParams): string {
  const base = apiClient.defaults.baseURL ?? "/api/v1";
  const qs = new URLSearchParams();
  if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params?.dateTo) qs.set("dateTo", params.dateTo);
  if (params?.country) qs.set("country", params.country);
  const query = qs.toString();
  return `${base}/reports/impact/csv${query ? `?${query}` : ""}`;
}
