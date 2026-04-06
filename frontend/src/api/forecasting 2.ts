import { apiClient } from "./client";

export interface PredictionPoint {
  forecast_date: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  model_source: string | null;
}

export interface ForecastResponse {
  supply_item_id: string;
  facility_id: string | null;
  model_run_id: string;
  predictions: PredictionPoint[];
}

export interface ModelRun {
  id: string;
  supply_item_id: string;
  facility_id: string | null;
  status: "queued" | "running" | "completed" | "failed";
  mlflow_run_id: string | null;
  metrics: Record<string, number> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function listModelRuns(limit = 10): Promise<ModelRun[]> {
  const res = await apiClient.get<ModelRun[]>("/forecasting/runs", { params: { limit } });
  return res.data;
}

export async function getForecast(
  supplyItemId: string,
  facilityId?: string,
  periods = 12,
): Promise<ForecastResponse> {
  const res = await apiClient.get<ForecastResponse>(`/forecasting/predict/${supplyItemId}`, {
    params: { facility_id: facilityId, periods },
  });
  return res.data;
}

export async function triggerTraining(
  supplyItemId: string,
  facilityId?: string,
): Promise<ModelRun> {
  const res = await apiClient.post<ModelRun>("/forecasting/train", {
    supply_item_id: supplyItemId,
    facility_id: facilityId,
  });
  return res.data;
}
