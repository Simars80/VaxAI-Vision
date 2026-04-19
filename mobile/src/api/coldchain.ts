import { apiClient } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColdChainFacility {
  id: string;
  name: string;
  country: string;
}

export interface ColdChainReading {
  facility_id: string;
  sensor_id: string;
  timestamp: string;
  temp_celsius: number;
  status: "normal" | "warning" | "breach";
}

export interface ColdChainAlert {
  id: string;
  facility_id: string;
  facility_name: string;
  country: string;
  sensor_id: string;
  alert_type: "high" | "low";
  peak_temp_celsius: number;
  threshold_celsius: number;
  start_time: string;
  end_time: string | null;
  resolved: boolean;
  severity: "critical" | "warning";
}

export interface AlertsResponse {
  alerts: ColdChainAlert[];
  total: number;
  active: number;
}

export interface ColdChainSummary {
  total_sensors: number;
  normal_count: number;
  warning_count: number;
  breach_count: number;
  active_alerts: number;
}

// ── API Calls ─────────────────────────────────────────────────────────────────

export async function getColdChainFacilities(): Promise<ColdChainFacility[]> {
  const res = await apiClient.get<{ facilities: ColdChainFacility[] }>("/cold-chain/facilities");
  return res.data.facilities;
}

export async function getColdChainReadings(
  facilityId?: string,
  since?: string,
): Promise<ColdChainReading[]> {
  const res = await apiClient.get<{ readings: ColdChainReading[] }>("/cold-chain/readings", {
    params: { facility_id: facilityId, since },
  });
  return res.data.readings;
}

export async function getColdChainAlerts(
  facilityId?: string,
  resolved?: boolean,
): Promise<AlertsResponse> {
  const res = await apiClient.get<AlertsResponse>("/cold-chain/alerts", {
    params: { facility_id: facilityId, resolved },
  });
  return res.data;
}

export async function getColdChainSummary(): Promise<ColdChainSummary> {
  const res = await apiClient.get<ColdChainSummary>("/cold-chain/summary");
  return res.data;
}

export async function resolveAlert(alertId: string): Promise<ColdChainAlert> {
  const res = await apiClient.post<ColdChainAlert>(`/cold-chain/alerts/${alertId}/resolve`);
  return res.data;
}
