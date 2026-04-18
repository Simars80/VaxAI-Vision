import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Target,
  Package,
  Activity,
  TrendingDown,
} from "lucide-react";
import { getCoverageFacilities, type Facility } from "@/api/coverage";

// ── Types ────────────────────────────────────────────────────────────────────

type Layer = "coverage" | "stock";

// ── Color utilities ──────────────────────────────────────────────────────────

function coverageColor(rate: number): string {
  if (rate >= 90) return "#16a34a";
  if (rate >= 80) return "#22c55e";
  if (rate >= 65) return "#84cc16";
  if (rate >= 50) return "#f59e0b";
  if (rate >= 35) return "#f97316";
  return "#ef4444";
}

const STOCK_COLOR: Record<string, string> = {
  adequate: "#22c55e",
  low: "#f59e0b",
  critical: "#ef4444",
};

const STOCK_TEXT: Record<string, string> = {
  adequate: "text-green-600",
  low: "text-amber-500",
  critical: "text-red-500",
};

const STOCK_ICON: Record<string, React.ElementType> = {
  adequate: CheckCircle,
  low: AlertTriangle,
  critical: XCircle,
};

function markerColor(f: Facility, layer: Layer): string {
  return layer === "coverage"
    ? coverageColor(f.coverageRate)
    : (STOCK_COLOR[f.stockStatus] ?? "#6b7280");
}

function markerRadius(targetPop: number): number {
  const logPop = Math.log10(Math.max(1000, targetPop));
  const logMin = Math.log10(1000);
  const logMax = Math.log10(500000);
  return 6 + ((logPop - logMin) / (logMax - logMin)) * 12;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CoverageBar({ rate }: { rate: number }) {
  const color = coverageColor(rate);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${rate}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-end" style={{ color }}>
        {rate}%
      </span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subLabel,
  color,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color }}>
              {value}
            </p>
            {subLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>
            )}
          </div>
          <div
            className="rounded-full p-1.5 mt-0.5 ms-2 flex-shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LayerToggle({
  layer,
  onChange,
}: {
  layer: Layer;
  onChange: (l: Layer) => void;
}) {
  const activeClass = "bg-background shadow text-foreground";
  const inactiveClass = "text-muted-foreground hover:text-foreground";
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1 gap-1">
      <button
        onClick={() => onChange("coverage")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
          layer === "coverage" ? activeClass : inactiveClass
        }`}
      >
        <Activity className="h-3.5 w-3.5 inline me-1.5 -mt-0.5" />
        Coverage Rate
      </button>
      <button
        onClick={() => onChange("stock")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
          layer === "stock" ? activeClass : inactiveClass
        }`}
      >
        <Package className="h-3.5 w-3.5 inline me-1.5 -mt-0.5" />
        Stock Status
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoverageMapPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("coverage");
  const [country, setCountry] = useState("All");
  const [vaccine, setVaccine] = useState("All");
  const [period, setPeriod] = useState("All");
  const [selected, setSelected] = useState<Facility | null>(null);
  const { t } = useTranslation();

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

  const filtered = useMemo(
    () =>
      facilities.filter(
        (f) =>
          (country === "All" || f.country === country) &&
          (vaccine === "All" || f.vaccineType === vaccine) &&
          (period === "All" || f.period === period),
      ),
    [facilities, country, vaccine, period],
  );

  const coverageStats = useMemo(() => {
    if (!filtered.length) return { avg: 0, whoTarget: 0, atRisk: 0, criticalGap: 0, gapDoses: 0 };
    const avg = Math.round(filtered.reduce((s, f) => s + f.coverageRate, 0) / filtered.length);
    const whoTarget = filtered.filter((f) => f.coverageRate >= 80).length;
    const atRisk = filtered.filter((f) => f.coverageRate >= 50 && f.coverageRate < 80).length;
    const criticalGap = filtered.filter((f) => f.coverageRate < 50).length;
    const gapDoses = filtered
      .filter((f) => f.coverageRate < 80)
      .reduce(
        (s, f) => s + Math.max(0, Math.round(f.targetPopulation * 0.8) - f.dosesAdministered),
        0,
      );
    return { avg, whoTarget, atRisk, criticalGap, gapDoses };
  }, [filtered]);

  const stockStats = useMemo(
    () => ({
      total: filtered.length,
      adequate: filtered.filter((f) => f.stockStatus === "adequate").length,
      low: filtered.filter((f) => f.stockStatus === "low").length,
      critical: filtered.filter((f) => f.stockStatus === "critical").length,
    }),
    [filtered],
  );

  const rankedFacilities = useMemo(() => {
    if (layer === "coverage") {
      return [...filtered].sort((a, b) => a.coverageRate - b.coverageRate);
    }
    const order: Record<string, number> = { critical: 0, low: 1, adequate: 2 };
    return [...filtered].sort(
      (a, b) => (order[a.stockStatus] ?? 3) - (order[b.stockStatus] ?? 3),
    );
  }, [filtered, layer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">{t("coverage.loadingFacilities")}</span>
      </div>
    );
  }

  const adequacyPct =
    stockStats.total > 0
      ? Math.round((stockStats.adequate / stockStats.total) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            {t("coverage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("coverage.subtitle")}</p>
        </div>
        <LayerToggle layer={layer} onChange={(l) => { setLayer(l); setSelected(null); }} />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              {t("coverage.filters")}
            </div>
            {(
              [
                { label: t("common.country"), value: country, options: allCountries, set: setCountry },
                { label: t("common.vaccine"), value: vaccine, options: allVaccines, set: setVaccine },
                { label: t("common.period"), value: period, options: allPeriods, set: setPeriod },
              ] as const
            ).map(({ label, value, options, set }) => (
              <div key={label} className="flex items-center gap-2">
                <label className="text-sm font-medium">{label}</label>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="text-sm border rounded-md px-2 py-1 bg-background"
                >
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}
            <span className="text-xs text-muted-foreground ms-auto">
              {t("common.showing", { count: filtered.length, total: facilities.length })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards — layer-specific */}
      {layer === "coverage" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Avg Coverage Rate"
            value={`${coverageStats.avg}%`}
            subLabel={coverageStats.avg >= 80 ? "Above WHO target" : "Below WHO 80% target"}
            color={coverageColor(coverageStats.avg)}
            icon={Activity}
          />
          <KpiCard
            label="WHO Target (≥80%)"
            value={coverageStats.whoTarget}
            subLabel={`of ${filtered.length} facilities`}
            color="#22c55e"
            icon={Target}
          />
          <KpiCard
            label="At Risk (50–79%)"
            value={coverageStats.atRisk}
            subLabel="Needs improvement"
            color="#f59e0b"
            icon={AlertTriangle}
          />
          <KpiCard
            label="Critical Gap (<50%)"
            value={coverageStats.criticalGap}
            subLabel={
              coverageStats.gapDoses > 0
                ? `~${(coverageStats.gapDoses / 1000).toFixed(0)}K doses needed`
                : undefined
            }
            color="#ef4444"
            icon={TrendingDown}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total Facilities"
            value={stockStats.total}
            color="#6366f1"
            icon={Package}
          />
          <KpiCard
            label="Adequate Stock"
            value={stockStats.adequate}
            subLabel={`${adequacyPct}% of facilities`}
            color="#22c55e"
            icon={CheckCircle}
          />
          <KpiCard
            label="Low Stock"
            value={stockStats.low}
            subLabel="Reorder soon"
            color="#f59e0b"
            icon={AlertTriangle}
          />
          <KpiCard
            label="Critical Stockout"
            value={stockStats.critical}
            subLabel={stockStats.critical > 0 ? "Immediate action needed" : "None"}
            color={stockStats.critical > 0 ? "#ef4444" : "#22c55e"}
            icon={XCircle}
          />
        </div>
      )}

      {/* Alert ribbon */}
      {layer === "coverage" && coverageStats.criticalGap > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{coverageStats.criticalGap} facilities</strong> are below 50% coverage —
            prioritise outreach and supply to close the immunisation gap.
          </span>
        </div>
      )}
      {layer === "stock" && stockStats.critical > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{stockStats.critical} facilities</strong> report critical stockouts —
            immediate restocking required.
          </span>
        </div>
      )}

      {/* Map + Sidebar */}
      <div className="flex gap-4">
        {/* Map */}
        <Card className="flex-1 overflow-hidden p-0">
          <MapContainer
            center={[4, 20]}
            zoom={4}
            style={{ height: 500, width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((facility) => (
              <CircleMarker
                key={`${facility.id}-${layer}`}
                center={[facility.lat, facility.lng]}
                radius={markerRadius(facility.targetPopulation)}
                pathOptions={{
                  fillColor: markerColor(facility, layer),
                  color: selected?.id === facility.id ? "#1e40af" : "#fff",
                  weight: selected?.id === facility.id ? 2.5 : 1.5,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => setSelected(facility) }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <p style={{ fontWeight: 700, marginBottom: 2 }}>{facility.name}</p>
                    <p style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>
                      {facility.region}, {facility.country}
                    </p>
                    <p style={{ fontSize: 12, marginBottom: 2 }}>
                      Coverage:{" "}
                      <strong style={{ color: coverageColor(facility.coverageRate) }}>
                        {facility.coverageRate}%
                      </strong>
                    </p>
                    <p style={{ fontSize: 12, marginBottom: 2 }}>
                      Stock:{" "}
                      <strong style={{ color: STOCK_COLOR[facility.stockStatus] ?? "#666" }}>
                        {facility.stockStatus}
                      </strong>
                    </p>
                    <p style={{ fontSize: 12 }}>
                      {facility.dosesAdministered.toLocaleString()} /{" "}
                      {facility.targetPopulation.toLocaleString()} doses
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Card>

        {/* Sidebar */}
        <div className="w-72 flex flex-col gap-3">
          {/* Legend */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm">
                {layer === "coverage" ? "Coverage Legend" : "Stock Legend"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {layer === "coverage" ? (
                <>
                  {[
                    { label: "Excellent ≥90%", color: "#16a34a" },
                    { label: "Good 80–89%", color: "#22c55e" },
                    { label: "Fair 65–79%", color: "#84cc16" },
                    { label: "Moderate 50–64%", color: "#f59e0b" },
                    { label: "Poor 35–49%", color: "#f97316" },
                    { label: "Critical <35%", color: "#ef4444" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color, boxShadow: "0 0 0 1.5px #aaa" }}
                      />
                      {label}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Marker size ∝ target population
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                      <Target className="h-3 w-3" />
                      WHO target: 80% coverage
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {[
                    { label: "Adequate", color: "#22c55e" },
                    { label: "Low — reorder soon", color: "#f59e0b" },
                    { label: "Critical — stockout", color: "#ef4444" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color, boxShadow: "0 0 0 1.5px #aaa" }}
                      />
                      {label}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t">
                    <p className="text-xs text-muted-foreground">
                      Marker size ∝ target population
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Facility detail panel */}
          {selected ? (
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-sm truncate" title={selected.name}>
                  {selected.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selected.region}, {selected.country}
                </p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("coverage.coverageRate")}
                  </p>
                  <CoverageBar rate={selected.coverageRate} />
                  {selected.coverageRate < 80 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Needs{" "}
                      {(
                        Math.round(selected.targetPopulation * 0.8) - selected.dosesAdministered
                      ).toLocaleString()}{" "}
                      more doses for WHO target
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("coverage.stockStatus")}
                  </p>
                  <div className={`flex items-center gap-1.5 ${STOCK_TEXT[selected.stockStatus]}`}>
                    {(() => {
                      const Icon = STOCK_ICON[selected.stockStatus];
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="text-sm font-semibold capitalize">
                      {selected.stockStatus}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("common.vaccine")}</p>
                    <Badge variant="outline" className="mt-0.5 text-xs">
                      {selected.vaccineType}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("common.period")}</p>
                    <p className="font-medium mt-0.5">{selected.period}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Doses Administered</p>
                    <p className="font-medium mt-0.5">
                      {selected.dosesAdministered.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target Population</p>
                    <p className="font-medium mt-0.5">
                      {selected.targetPopulation.toLocaleString()}
                    </p>
                  </div>
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

          {/* Ranked facility list */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                {layer === "coverage" ? "Lowest Coverage" : "Most Critical"} (
                {rankedFacilities.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {rankedFacilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className={`w-full text-start px-2 py-2 rounded text-xs flex items-center gap-2 transition-colors ${
                      selected?.id === f.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    {layer === "coverage" ? (
                      <>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: coverageColor(f.coverageRate) }}
                        />
                        <span className="truncate flex-1">{f.name}</span>
                        <span
                          className="font-semibold flex-shrink-0"
                          style={{ color: coverageColor(f.coverageRate) }}
                        >
                          {f.coverageRate}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STOCK_COLOR[f.stockStatus] ?? "#6b7280" }}
                        />
                        <span className="truncate flex-1">{f.name}</span>
                        <span
                          className={`font-semibold flex-shrink-0 capitalize ${STOCK_TEXT[f.stockStatus]}`}
                        >
                          {f.stockStatus}
                        </span>
                      </>
                    )}
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
