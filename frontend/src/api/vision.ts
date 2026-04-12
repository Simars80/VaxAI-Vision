import { apiClient } from "./client";

export type VVMStage = "stage_1" | "stage_2" | "stage_3" | "stage_4";

export interface VVMScanResult {
  classification: VVMStage;
  confidence: number;
  image_hash: string;
  usable: boolean;
}

export interface VVMScanResponse {
  result: VVMScanResult;
  model_version: string;
}

export interface EquipmentInspectionResult {
  status: string;
  details: string;
  image_hash: string;
}

export interface EquipmentInspectionResponse {
  result: EquipmentInspectionResult;
  model_version: string;
}

export interface ScanHistoryItem {
  id: string;
  facility_id: string;
  facility_name: string;
  classification: VVMStage;
  confidence: number;
  usable: boolean;
  scan_type: string;
  scanned_at: string;
}

export interface ModelStatusEntry {
  name: string;
  version: string;
  loaded: boolean;
  backend: string;
}

export async function scanVVM(imageFile: File): Promise<VVMScanResponse> {
  const form = new FormData();
  form.append("image", imageFile);
  const res = await apiClient.post<VVMScanResponse>("/vision/vvm/scan", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function inspectEquipment(imageFile: File): Promise<EquipmentInspectionResponse> {
  const form = new FormData();
  form.append("image", imageFile);
  const res = await apiClient.post<EquipmentInspectionResponse>("/vision/equipment/inspect", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getScanHistory(facilityId?: string, limit = 50): Promise<{ scans: ScanHistoryItem[]; total: number }> {
  const res = await apiClient.get<{ scans: ScanHistoryItem[]; total: number }>("/vision/scans/history", {
    params: { facility_id: facilityId, limit },
  });
  return res.data;
}

export async function getModelStatus(): Promise<ModelStatusEntry[]> {
  const res = await apiClient.get<{ models: ModelStatusEntry[] }>("/vision/models/status");
  return res.data.models;
}

export const VVM_STAGE_INFO: Record<VVMStage, { label: string; color: string; description: string }> = {
  stage_1: { label: "Stage 1", color: "#22c55e", description: "Inner square lighter than outer — vaccine fully potent" },
  stage_2: { label: "Stage 2", color: "#eab308", description: "Inner square same shade as outer — use soon" },
  stage_3: { label: "Stage 3", color: "#f97316", description: "Inner square darker than outer — do not use" },
  stage_4: { label: "Stage 4", color: "#ef4444", description: "Inner square much darker — discard immediately" },
};
