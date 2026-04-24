import { apiClient } from "./client";
import type {
  LogisticsDAG,
  SimulationRequest,
  SimulationResult,
} from "@/types/logistics";

export async function fetchLogisticsDAG(countryCode: string): Promise<LogisticsDAG> {
  const res = await apiClient.get<LogisticsDAG>(`/routes/dag/${countryCode}`);
  return res.data;
}

export async function runDisruptionSimulation(
  req: SimulationRequest,
): Promise<SimulationResult> {
  const res = await apiClient.post<SimulationResult>("/routes/simulate", req);
  return res.data;
}

/** Returns the base URL for the SSE narrative stream. */
export function narrativeStreamUrl(simulationId: string): string {
  const base = import.meta.env.VITE_API_URL ?? "/api/v1";
  return `${base}/routes/simulate/${simulationId}/narrative/stream`;
}
