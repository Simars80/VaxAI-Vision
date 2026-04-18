import { useCallback, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { addDays, format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getForecast, listModelRuns, triggerTraining } from "@/api/forecasting";
import { MOCK_STOCK_LEVELS } from "@/api/mockData";
import { AlertTriangle, BarChart2, Calendar, RefreshCw, TrendingUp } from "lucide-react";

// ── Type definitions ──────────────────────────────────────────────────────────

interface ChartPoint {
  date: string;
  forecast: number;
  lowerBound: number;
  upperBound: number;
}

interface RawPrediction {
  yhat: number;
  forecast_date: string;
}

// ── Static dropdown options (human-readable names → internal IDs) ─────────────

const VACCINE_OPTIONS = [
  { label: "BCG Vaccine", value: "v1" },
  { label: "OPV (Oral Polio)", value: "v2" },
  { label: "Pentavalent (DPT-HepB-Hib)", value: "v3" },
  { label: "Measles-Rubella", value: "v4" },
  { label: "Yellow Fever", value: "v5" },
  { label: "PCV-13 (Pneumococcal)", value: "v6" },
  { label: "Rotavirus", value: "v7" },
];

const FACILITY_OPTIONS = [
  { label: "All Facilities", value: "" },
  { label: "Lagos Central Vaccine Store", value: "FAC-001" },
  { label: "Kano General Hospital", value: "FAC-002" },
  { label: "Nairobi Central Clinic", value: "FAC-003" },
  { label: "Accra Regional Store", value: "FAC-004" },
  { label: "Abuja Health Centre", value: "FAC-005" },
  { label: "Dakar District Pharmacy", value: "FAC-006" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentStock(vaccineId: string, facilityId: string): number {
  if (!facilityId) return 0;
  const facility = MOCK_STOCK_LEVELS.facilities.find((f) => f.facility_id === facilityId);
  if (!facility) return 0;
  const item = facility.items.find((i) => i.supply_item_id === vaccineId);
  return item?.current_stock ?? 0;
}

function computeDaysUntilStockout(predictions: RawPrediction[], currentStock: number): number {
  if (predictions.length === 0 || currentStock <= 0) return 0;
  const avgMonthlyDemand = predictions.reduce((sum, p) => sum + p.yhat, 0) / predictions.length;
  if (avgMonthlyDemand <= 0) return 999;
  return Math.floor(currentStock / (avgMonthlyDemand / 30));
}

function computePeakDemandMonth(predictions: RawPrediction[]): string {
  if (predictions.length === 0) return "—";
  const peak = predictions.reduce((max, p) => (p.yhat > max.yhat ? p : max), predictions[0]);
  return format(parseISO(peak.forecast_date), "MMMM yyyy");
}

function stockoutColorClass(days: number, type: "text" | "border"): string {
  const colorMap = {
    text: { red: "text-red-600", amber: "text-amber-600", green: "text-green-600" },
    border: { red: "border-red-500", amber: "border-amber-500", green: "border-green-500" },
  };
  const shade = days < 30 ? "red" : days < 60 ? "amber" : "green";
  return colorMap[type][shade];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const [selectedVaccine, setSelectedVaccine] = useState("v1");
  const [selectedFacility, setSelectedFacility] = useState("FAC-001");
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [rawPredictions, setRawPredictions] = useState<RawPrediction[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vaccineName =
    VACCINE_OPTIONS.find((v) => v.value === selectedVaccine)?.label ?? selectedVaccine;
  const facilityName =
    FACILITY_OPTIONS.find((f) => f.value === selectedFacility)?.label ?? "All Facilities";
  const currentStock = getCurrentStock(selectedVaccine, selectedFacility);
  const daysUntilStockout = computeDaysUntilStockout(rawPredictions, currentStock);
  const peakDemandMonth = computePeakDemandMonth(rawPredictions);

  const avgMonthlyDemand =
    rawPredictions.length > 0
      ? rawPredictions.reduce((sum, p) => sum + p.yhat, 0) / rawPredictions.length
      : 0;
  const orderQty = Math.max(0, Math.ceil(avgMonthlyDemand * 2) - currentStock);
  const daysUntilOrder = Math.max(0, daysUntilStockout - 30);
  const orderByDate = format(addDays(new Date(), daysUntilOrder), "MMMM d, yyyy");

  const fetchForecast = useCallback(async (vaccineId: string, facilityId: string, horizon = 12) => {
    setLoading(true);
    setError(null);
    try {
      const [forecastResult, runs] = await Promise.all([
        getForecast(vaccineId, facilityId || undefined, horizon),
        listModelRuns(5),
      ]);
      setRawPredictions(forecastResult.predictions);
      setChartData(
        forecastResult.predictions.map((p) => ({
          date: format(parseISO(p.forecast_date), "MMM yyyy"),
          forecast: Math.round(p.yhat),
          lowerBound: Math.round(p.yhat_lower),
          upperBound: Math.round(p.yhat_upper),
        })),
      );
      const latestRun = runs.find((r) => r.status === "completed");
      if (latestRun) {
        setLastUpdated(format(parseISO(latestRun.created_at), "MMM d, yyyy 'at' HH:mm"));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load forecast");
      setChartData([]);
      setRawPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount with BCG Vaccine + Lagos Central Vaccine Store
  useEffect(() => {
    fetchForecast("v1", "FAC-001", 12);
  }, [fetchForecast]);

  const handleVaccineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVaccine = e.target.value;
    setSelectedVaccine(newVaccine);
    fetchForecast(newVaccine, selectedFacility, horizonMonths);
  };

  const handleFacilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFacility = e.target.value;
    setSelectedFacility(newFacility);
    fetchForecast(selectedVaccine, newFacility, horizonMonths);
  };

  const handleRefresh = async () => {
    setRefreshLoading(true);
    setError(null);
    try {
      await triggerTraining(selectedVaccine, selectedFacility || undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      await fetchForecast(selectedVaccine, selectedFacility, horizonMonths);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to refresh forecast");
    } finally {
      setRefreshLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">Demand Forecasting</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered vaccine demand predictions to guide procurement decisions
        </p>
      </div>

      {/* Dropdown selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48 space-y-1">
              <label className="text-sm font-medium">Vaccine</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedVaccine}
                onChange={handleVaccineChange}
                disabled={loading}
              >
                {VACCINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48 space-y-1">
              <label className="text-sm font-medium">Facility</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedFacility}
                onChange={handleFacilityChange}
                disabled={loading}
              >
                {FACILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48 space-y-1">
              <label className="text-sm font-medium">Forecast Horizon</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={horizonMonths}
                onChange={(e) => {
                  const newHorizon = Number(e.target.value);
                  setHorizonMonths(newHorizon);
                  fetchForecast(selectedVaccine, selectedFacility, newHorizon);
                }}
                disabled={loading}
              >
                {[1, 2, 3, 6, 12, 18, 24].map((m) => (
                  <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}</option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mt-3">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Insight cards */}
      {(chartData.length > 0 || loading) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`h-5 w-5 mt-0.5 ${loading ? "text-muted-foreground" : stockoutColorClass(daysUntilStockout, "text")}`}
                />
                <div>
                  <p className="text-sm text-muted-foreground">Days Until Stockout</p>
                  {loading ? (
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                  ) : (
                    <p
                      className={`text-2xl font-bold ${stockoutColorClass(daysUntilStockout, "text")}`}
                    >
                      {daysUntilStockout >= 999 ? "> 999" : daysUntilStockout}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedFacility
                      ? `Current stock: ${currentStock.toLocaleString()} doses`
                      : "Select a facility for stock data"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 mt-0.5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Peak Demand Month</p>
                  {loading ? (
                    <p className="text-lg font-bold text-muted-foreground">—</p>
                  ) : (
                    <p className="text-lg font-bold">{peakDemandMonth}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Highest predicted need</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Forecast Horizon</p>
                  <p className="text-2xl font-bold">{horizonMonths} {horizonMonths === 1 ? "month" : "months"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Forward-looking window</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-center h-40">
            <p className="text-muted-foreground">Loading forecast…</p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Predicted Vaccine Demand — {vaccineName} at {facilityName}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Shaded band = 85% confidence interval
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                <defs>
                  <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  label={{ value: "Month", position: "insideBottom", offset: -10, fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Doses",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(val: number, name: string) => [val.toLocaleString(), name]}
                />
                <Legend />
                {currentStock > 0 && (
                  <ReferenceLine
                    y={currentStock}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{
                      value: "Current Stock",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#ef4444",
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="url(#bandGradient)"
                  name="Upper Bound"
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke="#3b82f6"
                  fill="url(#predGradient)"
                  strokeWidth={2}
                  name="Forecast"
                />
                <Area
                  type="monotone"
                  dataKey="lowerBound"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  fill="transparent"
                  name="Lower Bound"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty / unavailable state */}
      {!loading && chartData.length === 0 && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center justify-center h-40 gap-3">
            <BarChart2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              No forecast data available yet.
              <br />
              Click <strong>Refresh Forecast</strong> to generate a new prediction for this vaccine
              and facility.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recommendation banner */}
      {!loading && chartData.length > 0 && selectedFacility && (
        <Card className={`border-l-4 ${stockoutColorClass(daysUntilStockout, "border")}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                💡
              </span>
              <div className="space-y-1">
                <p className="font-semibold">Recommendation</p>
                <p className="text-sm text-muted-foreground">
                  At the current forecast rate, your stock of <strong>{vaccineName}</strong> at{" "}
                  <strong>{facilityName}</strong> will last approximately{" "}
                  <span
                    className={`font-bold ${stockoutColorClass(daysUntilStockout, "text")}`}
                  >
                    {daysUntilStockout >= 999 ? "more than 999" : daysUntilStockout} days
                  </span>
                  .
                </p>
                {orderQty > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    To maintain a 30-day safety stock, order{" "}
                    <strong>{orderQty.toLocaleString()} doses</strong> by{" "}
                    <strong>{orderByDate}</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-green-700">
                    Current stock covers the 2-month safety buffer — no immediate order needed.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last updated + refresh */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm text-muted-foreground">
              {lastUpdated
                ? `Forecast last updated: ${lastUpdated}`
                : "Forecast data not yet generated."}
            </p>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshLoading || loading}>
              <RefreshCw className={`h-4 w-4 ${refreshLoading ? "animate-spin" : ""}`} />
              {refreshLoading ? "Refreshing…" : "Refresh Forecast"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
