import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter, AlertTriangle, CheckCircle, XCircle, Loader2, Route } from "lucide-react";
import { getCoverageFacilities, type Facility } from "@/api/coverage";
import { LogisticsOverlayLayer } from "@/components/map/LogisticsOverlayLayer";

function coverageColor(rate: number): string {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

const STOCK_ICON: Record<string, React.ElementType> = {
  adequate: CheckCircle,
  low: AlertTriangle,
  critical: XCircle,
};

const STOCK_COLOR: Record<string, string> = {
  adequate: "text-green-600",
  low: "text-amber-500",
  critical: "text-red-500",
};

export default function CoverageMapPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("All");
  const [vaccine, setVaccine] = useState("All");
  const [period, setPeriod] = useState("All");
  const [selected, setSelected] = useState<Facility | null>(null);
  const { t } = useTranslation();

  // Logistics overlay state
  const [routeOverlayEnabled, setRouteOverlayEnabled] = useState(false);
  const [disruptionPanel, setDisruptionPanel] = useState<React.ReactNode>(null);

  const handlePanelChange = useCallback((panel: React.ReactNode) => {
    setDisruptionPanel(panel);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCoverageFacilities()
      .then(setFacilities)
      .catch(() => setError(t("coverage.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const allCountries = useMemo(
    () => ["All", ...Array.from(new Set(facilities.map((f) => f.country))).sort()],
    [facilities],
  );
  const allVaccines = useMemo(
    () => ["All", ...Array.from(new Set(facilities.map((f) => f.vaccineType))).sort()],
    [facilities],
  );
  const allPeriods = useMemo(
    () => ["All", ...Array.from(new Set(facilities.map((f) => f.period))).sort()],
    [facilities],
  );

  const filtered = useMemo(() => {
    return facilities.filter(
      (f) =>
        (country === "All" || f.country === country) &&
        (vaccine === "All" || f.vaccineType === vaccine) &&
        (period === "All" || f.period === period),
    );
  }, [facilities, country, vaccine, period]);

  const stats = useMemo(() => {
    const high = filtered.filter((f) => f.coverageRate >= 80).length;
    const medium = filtered.filter((f) => f.coverageRate >= 50 && f.coverageRate < 80).length;
    const low = filtered.filter((f) => f.coverageRate < 50).length;
    const avgCoverage =
      filtered.length > 0
        ? Math.round(filtered.reduce((s, f) => s + f.coverageRate, 0) / filtered.length)
        : 0;
    return { high, medium, low, avgCoverage };
  }, [filtered]);

  // Derive country code from selected country filter (default "NG").
  const countryCode = country !== "All" ? country.slice(0, 2).toUpperCase() : "NG";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">{t("coverage.loadingFacilities")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8 text-primary" />
          {t("coverage.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("coverage.subtitle")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              {t("coverage.filters")}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t("common.country")}</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-background"
              >
                {allCountries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t("common.vaccine")}</label>
              <select
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-background"
              >
                {allVaccines.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t("common.period")}</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-background"
              >
                {allPeriods.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Route Overlay Toggle */}
            <div className="flex items-center gap-2 ms-auto">
              <button
                onClick={() => setRouteOverlayEnabled((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                  routeOverlayEnabled
                    ? "bg-indigo-600 text-white border-indigo-700"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <Route className="h-3.5 w-3.5" />
                Route Overlay
              </button>
            </div>

            <span className="text-xs text-muted-foreground">
              {t("common.showing", { count: filtered.length, total: facilities.length })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t("coverage.avgCoverage")}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: coverageColor(stats.avgCoverage) }}>
              {stats.avgCoverage}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t("coverage.high80")}</p>
            <p className="text-2xl font-bold mt-0.5 text-green-600">{stats.high}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t("coverage.medium50")}</p>
            <p className="text-2xl font-bold mt-0.5 text-amber-500">{stats.medium}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">{t("coverage.low50")}</p>
            <p className="text-2xl font-bold mt-0.5 text-red-500">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Card className="flex-1 overflow-hidden p-0 relative">
          <MapContainer
            center={[4, 20]}
            zoom={4}
            style={{ height: 480, width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((facility) => (
              <CircleMarker
                key={facility.id}
                center={[facility.lat, facility.lng]}
                radius={10}
                pathOptions={{
                  fillColor: coverageColor(facility.coverageRate),
                  color: "#fff",
                  weight: 1.5,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => setSelected(facility) }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{facility.name}</p>
                    <p style={{ color: "#666", fontSize: 12 }}>{facility.region}, {facility.country}</p>
                    <p style={{ fontSize: 12 }}>{t("coverage.coverageRate")}: <strong>{facility.coverageRate}%</strong></p>
                    <p style={{ fontSize: 12 }}>{t("coverage.stockStatus")}: <strong>{facility.stockStatus}</strong></p>
                    <p style={{ fontSize: 12 }}>{t("common.vaccine")}: <strong>{facility.vaccineType}</strong></p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Logistics DAG overlay — renders edges, nodes, spinners, and error banners */}
            <LogisticsOverlayLayer
              countryCode={countryCode}
              enabled={routeOverlayEnabled}
              onPanelChange={handlePanelChange}
            />
          </MapContainer>
        </Card>

        <div className="w-72 flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">{t("coverage.coverageLegend")}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: t("coverage.high80"), color: "#22c55e" },
                { label: t("coverage.medium50"), color: "#f59e0b" },
                { label: t("coverage.low50"), color: "#ef4444" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: color, boxShadow: "0 0 0 1.5px #888" }}
                  />
                  {label}
                </div>
              ))}

              {/* Route overlay legend */}
              {routeOverlayEnabled && (
                <>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Route Overlay</p>
                    {[
                      { label: "Normal route", color: "#3b82f6" },
                      { label: "Disrupted route", color: "#ef4444" },
                      { label: "Alternative route", color: "#22c55e" },
                      { label: "Affected node", color: "#f97316" },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-2 text-xs mb-1">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: color, boxShadow: "0 0 0 1.5px #888" }}
                        />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Disruption panel (populated by LogisticsOverlayLayer) */}
          {routeOverlayEnabled && disruptionPanel}

          {selected ? (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm truncate">{selected.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("coverage.location")}</p>
                  <p className="font-medium">{selected.region}, {selected.country}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("coverage.coverageRate")}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${selected.coverageRate}%`,
                          backgroundColor: coverageColor(selected.coverageRate),
                        }}
                      />
                    </div>
                    <span className="font-bold text-sm" style={{ color: coverageColor(selected.coverageRate) }}>
                      {selected.coverageRate}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("coverage.stockStatus")}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {(() => {
                      const Icon = STOCK_ICON[selected.stockStatus];
                      return <Icon className={`h-4 w-4 ${STOCK_COLOR[selected.stockStatus]}`} />;
                    })()}
                    <span className={`font-medium capitalize ${STOCK_COLOR[selected.stockStatus]}`}>
                      {selected.stockStatus}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs">{t("common.vaccine")}</p>
                    <Badge variant="outline" className="mt-0.5 text-xs">{selected.vaccineType}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t("common.period")}</p>
                    <p className="font-medium">{selected.period}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("coverage.dosesAdministered")}</p>
                  <p className="font-medium">{selected.dosesAdministered.toLocaleString()} / {selected.targetPopulation.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <p className="text-sm text-muted-foreground text-center">
                  {t("coverage.clickToSeeDetails")}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">{t("reports.facilities")} ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className={`w-full text-start px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                      selected?.id === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: coverageColor(f.coverageRate) }}
                    />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="font-medium flex-shrink-0">{f.coverageRate}%</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
