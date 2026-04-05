import { apiClient } from "./client";

export interface SupplyItem {
  id: string;
  external_code: string | null;
  name: string;
  category: string;
  unit_of_measure: string | null;
  created_at: string;
}

export interface SupplyTransaction {
  id: string;
  supply_item_id: string;
  transaction_type: string;
  quantity: number;
  facility_id: string | null;
  facility_name: string | null;
  transaction_date: string | null;
  lot_number: string | null;
}

export interface IngestionJob {
  id: string;
  source: string;
  status: string;
  file_name: string | null;
  rows_total: number | null;
  rows_succeeded: number | null;
  rows_failed: number | null;
  created_at: string;
  completed_at: string | null;
}

export async function listIngestionJobs(limit = 20): Promise<IngestionJob[]> {
  const res = await apiClient.get<IngestionJob[]>("/ingestion/jobs", {
    params: { limit },
  });
  return res.data;
}

export async function uploadCsv(file: File): Promise<IngestionJob> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<IngestionJob>("/ingestion/upload/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
