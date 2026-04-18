import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpenLMISConnectionConfig {
  serverUrl: string;
  username: string;
  password: string;
}

export interface OpenLMISTestResult {
  success: boolean;
  message: string;
  serverInfo?: string;
}

export interface OpenLMISSyncStatus {
  lastSyncTime: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  inProgress: boolean;
}

export interface OpenLMISSyncResult {
  success: boolean;
  recordsFetched: number;
  recordsCreated: number;
  recordsFailed: number;
  completedAt: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const BASE = "/integrations/openlmis";

export async function getOpenLMISConfig(): Promise<OpenLMISConnectionConfig | null> {
  const { data } = await apiClient.get(`${BASE}/configs`);
  // backend returns array; take latest
  return Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;
}

export async function saveOpenLMISConfig(
  config: OpenLMISConnectionConfig,
): Promise<void> {
  await apiClient.post(`${BASE}/configs`, config);
}

export async function testOpenLMISConnection(
  config: OpenLMISConnectionConfig,
): Promise<OpenLMISTestResult> {
  const { data } = await apiClient.post(`${BASE}/test`, config);
  return data;
}

export async function getOpenLMISSyncStatus(): Promise<OpenLMISSyncStatus> {
  const { data } = await apiClient.get(`${BASE}/sync/status`);
  return data;
}

export async function triggerOpenLMISSync(): Promise<OpenLMISSyncResult> {
  const { data } = await apiClient.post(`${BASE}/sync`);
  return data;
}
