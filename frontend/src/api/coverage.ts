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

// Backend may return either a raw array (demo/mock) or a paginated envelope
// { total: number, facilities: FacilityItem[] } with snake_case keys.
interface FacilityEnvelope {
  total: number;
  facilities: Array<Record<string, unknown>>;
}

function normaliseFacility(raw: Record<string, unknown>): Facility {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    country: String(raw.country ?? ""),
    region: String(raw.region ?? ""),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    coverageRate: Number(raw.coverageRate ?? raw.coverage_rate ?? 0),
    stockStatus: (raw.stockStatus ?? raw.stock_status ?? "adequate") as Facility["stockStatus"],
    vaccineType: String(raw.vaccineType ?? raw.vaccine_type ?? ""),
    period: String(raw.period ?? ""),
    dosesAdministered: Number(raw.dosesAdministered ?? raw.doses_administered ?? 0),
    targetPopulation: Number(raw.targetPopulation ?? raw.target_population ?? 0),
  };
}

export async function getCoverageFacilities(
  params?: CoverageFacilitiesParams,
): Promise<Facility[]> {
  const res = await apiClient.get<FacilityEnvelope | Array<Record<string, unknown>>>(
    "/coverage/facilities",
    { params },
  );
  const data = res.data;
  const raw: Array<Record<string, unknown>> = Array.isArray(data)
    ? data
    : (data as FacilityEnvelope).facilities ?? [];
  return raw.map(normaliseFacility);
}
