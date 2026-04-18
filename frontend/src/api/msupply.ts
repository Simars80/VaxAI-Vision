import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MSupplyConnectionConfig {
  serverUrl: string;
  apiKey: string;
}

export interface MSupplyTestResult {
  success: boolean;
  message: string;
  serverInfo?: string;
}

export interface MSupplySyncStatus {
  lastSyncTime: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  inProgress: boolean;
}

export interface MSupplySyncResult {
  success: boolean;
  recordsFetched: number;
  recordsCreated: number;
  recordsFailed: number;
  completedAt: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const BASE = "/integrations/msupply";

export async function getMSupplyConfig(): Promise<MSupplyConnectionConfig | null> {
  const { data } = await apiClient.get(`${BASE}/configs`);
  return Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;
}

export async function saveMSupplyConfig(
  config: MSupplyConnectionConfig,
): Promise<void> {
  await apiClient.post(`${BASE}/configs`, config);
}

export async function testMSupplyConnection(
  config: MSupplyConnectionConfig,
): Promise<MSupplyTestResult> {
  const { data } = await apiClient.post(`${BASE}/test`, config);
  return data;
}

export async function getMSupplySyncStatus(): Promise<MSupplySyncStatus> {
  const { data } = await apiClient.get(`${BASE}/sync/status`);
  return data;
}

export async function triggerMSupplySync(): Promise<MSupplySyncResult> {
  const { data } = await apiClient.post(`${BASE}/sync`);
  return data;
}
