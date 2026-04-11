import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Dhis2ConnectionConfig {
  instanceUrl: string;
  username: string;
  password: string;
}

export interface Dhis2TestResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}

export interface Dhis2FieldMapping {
  dhis2Element: string;
  dhis2ElementName: string;
  vaxaiField: string;
  vaxaiFieldLabel: string;
  dataType: string;
  enabled: boolean;
}

export interface Dhis2SyncStatus {
  lastSyncTime: string | null;
  recordsSynced: number;
  recordsFailed: number;
  errors: string[];
  inProgress: boolean;
}

export interface Dhis2SyncResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  errors: string[];
  completedAt: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const DHIS2_BASE = "/integrations/dhis2";

export async function getDhis2Config(): Promise<Dhis2ConnectionConfig | null> {
  const { data } = await apiClient.get(`${DHIS2_BASE}/config`);
  return data;
}

export async function saveDhis2Config(
  config: Dhis2ConnectionConfig,
): Promise<void> {
  await apiClient.put(`${DHIS2_BASE}/config`, config);
}

export async function testDhis2Connection(
  config: Dhis2ConnectionConfig,
): Promise<Dhis2TestResult> {
  const { data } = await apiClient.post(`${DHIS2_BASE}/test-connection`, config);
  return data;
}

export async function getDhis2Mappings(): Promise<Dhis2FieldMapping[]> {
  const { data } = await apiClient.get(`${DHIS2_BASE}/mappings`);
  return data;
}

export async function getDhis2SyncStatus(): Promise<Dhis2SyncStatus> {
  const { data } = await apiClient.get(`${DHIS2_BASE}/sync/status`);
  return data;
}

export async function triggerDhis2Sync(): Promise<Dhis2SyncResult> {
  const { data } = await apiClient.post(`${DHIS2_BASE}/sync`);
  return data;
}
