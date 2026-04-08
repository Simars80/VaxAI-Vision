import { apiClient } from "./client";

export interface Facility {
  id: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  coverageRate: number;
  stockStatus: "adequate" | "low" | "critical";
  vaccineType: string;
  period: string;
  dosesAdministered: number;
  targetPopulation: number;
}

export interface CoverageFacilitiesParams {
  country?: string;
  vaccine_type?: string;
  stock_status?: string;
}

export async function getCoverageFacilities(
  params?: CoverageFacilitiesParams,
): Promise<Facility[]> {
  const res = await apiClient.get<Facility[]>("/coverage/facilities", { params });
  return res.data;
}
