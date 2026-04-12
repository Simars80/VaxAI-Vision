import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  AlertTriangle,
  CheckCircle,
  Snowflake,
  Loader2,
} from "lucide-react";
import {
  getColdChainFacilities,
  getColdChainReadings,
  getColdChainAlerts,
  type ColdChainFacility,
  type ColdChainReading,
  type ColdChainAlert,
} from "@/api/coldchain";

const THRESHOLD_LOW = 2.0;
const THRESHOLD_HIGH = 8.0;
const POLL_INTERVAL_MS = 30_000;
const CHART_HOURS = 3;

function deriveStatus(
  facilityId: string,
  alerts: ColdChainAlert[],
): "ok" | "warning" | "breach" {
  const facAlerts = alerts.filter((a) => a.facility_id === facilityId);
  if (facAlerts.some((a) => !a.resolved)) return "breach";
  if (facAlerts.length > 0) return "warning";
  return "ok";
}

function toChartReadings(
  readings: ColdChainReading[],
): { time: string; temp: number }[] {
  const cutoff = Date.now() - CHART_HOURS * 60 * 60 * 1000;
  return readings
    .filter((r) => new Date(r.timestamp).getTime() >= cutoff)
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      temp: r.temp_celsius,
    }));
}

function latestTemp(readings: ColdChainReading[]): number | null {
  if (readings.length === 0) return null;
  return readings[readings.length - 1].temp_celsius;
}

function StatusBadge({ status }: { status: "ok" | "warning" | "breach" }) {
  const { t } = useTranslation();
  if (status === "ok")
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" /> {t("coldChain.ok")}
      </Badge>
    );
  if (status === "warning")
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> {t("coldChain.warning")}
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> {t("coldChain.breach")}
    </Badge>
  );
}

function FacilityCard({
  facility,
  status,
  currentTemp,
  selected,
  onClick,
}: {
  facility: ColdChainFacility;
  status: "ok" | "warning" | "breach";
  currentTemp: number | null;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const borderColor =
    status === "breach"
      ? "border-destructive"
      : status === "warning"
        ? "border-yellow-400"
        : "border-border";

  return (
    <button
      onClick={onClick}
      className={`w-full text-start rounded-lg border-2 p-4 transition-all hover:shadow-md ${borderColor} ${
        selected ? "bg-primary/5 shadow-md" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm">{facility.name}</p>
          <p className="text-xs text-muted-foreground">{facility.country}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-center justify-center gap-2">
        <Snowflake className="h-4 w-4 text-blue-400" />
        {currentTemp !== null ? (
          <p className="text-2xl font-bold tabular-nums text-primary">
            {currentTemp > 0 ? "+" : ""}
            {currentTemp.toFixed(1)}°C
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
      </div>
      <div className="mt-3 text-xs text-muted-foreground text-center">
        {t("coldChain.safe", { low: THRESHOLD_LOW, high: THRESHOLD_HIGH })}
      </div>
    </button>
  );
}

export default function ColdChainPage() {
  const [facilities, setFacilities] = useState<ColdChainFacility[]>([]);
  const [allAlerts, setAllAlerts] = useState<ColdChainAlert[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [readings, setReadings] = useState<ColdChainReading[]>([]);
  const [facilityAlerts, setFacilityAlerts] = useState<ColdChainAlert[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([getColdChainFacilities(), getColdChainAlerts()])
      .then(([facs, alertsResp]) => {
        setFacilities(facs);
        setAllAlerts(alertsResp.alerts);
        if (facs.length > 0) setSelectedFacilityId(facs[0].id);
      })
      .catch(() => setError(t("coldChain.loadError")))
      .finally(() => setLoadingInit(false));
  }, [t]);

  const fetchFacilityData = useCallback((facilityId: string) => {
    setLoadingReadings(true);
    Promise.all([
      getColdChainReadings(facilityId),
      getColdChainAlerts(facilityId),
    ])
      .then(([r, alertsResp]) => {
        setReadings(r);
        setFacilityAlerts(alertsResp.alerts);
      })
      .catch(() => {})
      .finally(() => setLoadingReadings(false));
  }, []);

  useEffect(() => {
    if (!selectedFacilityId) return;
    fetchFacilityData(selectedFacilityId);
    const timer = setInterval(() => fetchFacilityData(selectedFacilityId), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [selectedFacilityId, fetchFacilityData]);

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">{t("coldChain.loadingData")}</span>
      </div>
    );
  }

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId) ?? null;
  const chartData = toChartReadings(readings);
  const currentTemp = latestTemp(readings);
  const activeBreaches = allAlerts.filter((a) => !a.resolved).length;
  const okCount = facilities.filter((f) => deriveStatus(f.id, allAlerts) === "ok").length;
  const warnCount = facilities.filter((f) => deriveStatus(f.id, allAlerts) === "warning").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("coldChain.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("coldChain.subtitle")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("coldChain.totalFacilities")}</p>
                <p className="text-2xl font-bold">{facilities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("coldChain.inRange")}</p>
                <p className="text-2xl font-bold text-green-600">{okCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("coldChain.warnings")}</p>
                <p className="text-2xl font-bold text-yellow-600">{warnCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("coldChain.activeBreaches")}</p>
                <p className="text-2xl font-bold text-destructive">{activeBreaches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3 overflow-y-auto max-h-[700px] pe-1">
          {facilities.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              status={deriveStatus(facility.id, allAlerts)}
              currentTemp={
                selectedFacilityId === facility.id ? currentTemp : null
              }
              selected={facility.id === selectedFacilityId}
              onClick={() => setSelectedFacilityId(facility.id)}
            />
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedFacility?.name ?? t("coldChain.selectFacility")} — {t("coldChain.lastHours", { hours: CHART_HOURS })}
                  {loadingReadings && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </CardTitle>
                {selectedFacility && (
                  <StatusBadge status={deriveStatus(selectedFacility.id, allAlerts)} />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedFacility?.country} · {t("coldChain.autoRefresh")}
              </p>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 && !loadingReadings ? (
                <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">
                  {t("coldChain.noReadings")}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={[
                        (dataMin: number) => Math.floor(dataMin - 2),
                        (dataMax: number) => Math.ceil(dataMax + 2),
                      ]}
                      tickFormatter={(v) => `${v}°`}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val}°C`, t("coldChain.temperature")]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={THRESHOLD_HIGH}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{ value: `Max ${THRESHOLD_HIGH}°C`, fontSize: 10, fill: "#ef4444" }}
                    />
                    <ReferenceLine
                      y={THRESHOLD_LOW}
                      stroke="#3b82f6"
                      strokeDasharray="4 4"
                      label={{ value: `Min ${THRESHOLD_LOW}°C`, fontSize: 10, fill: "#3b82f6" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      name={t("coldChain.temperature")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("coldChain.breachTimeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              {facilityAlerts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {t("coldChain.noBreaches")}
                </div>
              ) : (
                <div className="space-y-3">
                  {facilityAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center gap-4 p-3 rounded-md border ${
                        !alert.resolved
                          ? "bg-destructive/5 border-destructive/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          !alert.resolved ? "bg-destructive" : "bg-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {alert.alert_type === "high" ? t("coldChain.highTempBreach") : t("coldChain.lowTempBreach")}
                          </span>
                          {!alert.resolved && (
                            <Badge variant="destructive" className="text-xs py-0">
                              {t("common.active")}
                            </Badge>
                          )}
                          <Badge
                            variant={alert.severity === "critical" ? "destructive" : "warning"}
                            className="text-xs py-0"
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(alert.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {alert.end_time
                            ? ` – ${new Date(alert.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : ` – ${t("coldChain.ongoing")}`}
                          {" · "}{t("coldChain.peak")}: {alert.peak_temp_celsius > 0 ? "+" : ""}
                          {alert.peak_temp_celsius}°C
                          {" · "}{t("coldChain.threshold")}: {alert.threshold_celsius}°C
                          {" · "}{t("coldChain.sensor")}: {alert.sensor_id}
                        </p>
                      </div>
                      <AlertTriangle
                        className={`h-4 w-4 flex-shrink-0 ${
                          !alert.resolved ? "text-destructive" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
