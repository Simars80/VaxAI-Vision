import { apiClient } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface StockLevelItem {
  supply_item_id: string;
  name: string;
  category: string;
  unit_of_measure: string | null;
  current_stock: number;
  status: "adequate" | "low" | "critical";
}

export interface FacilityStockLevel {
  facility_id: string;
  facility_name: string;
  items: StockLevelItem[];
}

export interface StockSummary {
  total_facilities: number;
  total_vaccines: number;
  critical_count: number;
  low_count: number;
  adequate_count: number;
  facilities: FacilityStockLevel[];
}

export interface StockAdjustment {
  supply_item_id: string;
  facility_id: string;
  quantity: number;
  transaction_type: "receipt" | "issue" | "adjustment" | "loss";
  lot_number?: string;
  notes?: string;
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

// ── API Calls ─────────────────────────────────────────────────────────────────

export async function getStockLevels(params?: {
  category?: string;
  facility_id?: string;
  limit_facilities?: number;
}): Promise<StockSummary> {
  const res = await apiClient.get<StockSummary>("/inventory/stock-levels", { params });
  return res.data;
}

export async function listSupplyItems(params?: {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<SupplyItem[]> {
  const res = await apiClient.get<SupplyItem[]>("/inventory/items", { params });
  return res.data;
}

export async function getSupplyItem(id: string): Promise<SupplyItem> {
  const res = await apiClient.get<SupplyItem>(`/inventory/items/${id}`);
  return res.data;
}

export async function getTransactions(params?: {
  supply_item_id?: string;
  facility_id?: string;
  limit?: number;
  offset?: number;
}): Promise<SupplyTransaction[]> {
  const res = await apiClient.get<SupplyTransaction[]>("/inventory/transactions", { params });
  return res.data;
}

export async function recordStockAdjustment(adjustment: StockAdjustment): Promise<SupplyTransaction> {
  const res = await apiClient.post<SupplyTransaction>("/inventory/transactions", adjustment);
  return res.data;
}

export async function listIngestionJobs(limit = 20): Promise<IngestionJob[]> {
  const res = await apiClient.get<IngestionJob[]>("/ingestion/jobs", { params: { limit } });
  return res.data;
}
