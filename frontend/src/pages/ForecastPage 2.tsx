import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getForecast, triggerTraining, listModelRuns, type ModelRun } from "@/api/forecasting";
import { TrendingUp, Play, RefreshCw } from "lucide-react";

interface ChartPoint {
  date: string;
  actual?: number;
  predicted: number;
  lower: number;
  upper: number;
}

export default function ForecastPage() {
  const [itemId, setItemId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [modelRuns, setModelRuns] = useState<ModelRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [trainLoading, setTrainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModelRuns(5).then(setModelRuns).catch(console.error);
  }, []);

  const fetchForecast = async () => {
    if (!itemId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getForecast(itemId.trim(), facilityId.trim() || undefined);
      setChartData(
        result.predictions.map((p) => ({
          date: format(parseISO(p.forecast_date), "MMM d"),
          predicted: Math.round(p.yhat),
          lower: Math.round(p.yhat_lower),
          upper: Math.round(p.yhat_upper),
        })),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load forecast");
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    if (!itemId.trim()) return;
    setTrainLoading(true);
    setError(null);
    try {
      await triggerTraining(itemId.trim(), facilityId.trim() || undefined);
      const runs = await listModelRuns(5);
      setModelRuns(runs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to trigger training");
    } finally {
      setTrainLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Demand Forecasting</h1>
        <p className="text-muted-foreground mt-1">
          Prophet + LightGBM ensemble predictions for supply demand
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48 space-y-1">
              <label className="text-sm font-medium">Supply Item ID</label>
              <Input
                placeholder="UUID of supply item"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-48 space-y-1">
              <label className="text-sm font-medium">Facility ID (optional)</label>
              <Input
                placeholder="Filter by facility"
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              />
            </div>
            <Button onClick={fetchForecast} disabled={loading || !itemId}>
              <TrendingUp className="h-4 w-4" />
              {loading ? "Loading…" : "Show Forecast"}
            </Button>
            <Button variant="outline" onClick={handleTrain} disabled={trainLoading || !itemId}>
              {trainLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {trainLoading ? "Queuing…" : "Train Model"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mt-3">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Forecast chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">12-Period Demand Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(val: number, name: string) => [
                    val.toLocaleString(),
                    name === "predicted" ? "Forecast" : name === "lower" ? "Lower 85%" : "Upper 85%",
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="url(#bandGradient)"
                  name="upper"
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#3b82f6"
                  fill="url(#predGradient)"
                  strokeWidth={2}
                  name="predicted"
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="transparent"
                  name="lower"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent model runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Training Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {modelRuns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No model runs yet.</p>
          ) : (
            <div className="space-y-2">
              {modelRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div>
                    <p className="text-sm font-mono">{run.supply_item_id.slice(0, 16)}…</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(run.created_at), "MMM d, HH:mm")}
                      {run.metrics?.mae != null && ` · MAE: ${run.metrics.mae.toFixed(1)}`}
                      {run.metrics?.rmse != null && ` · RMSE: ${run.metrics.rmse.toFixed(1)}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      run.status === "completed"
                        ? "success"
                        : run.status === "failed"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
