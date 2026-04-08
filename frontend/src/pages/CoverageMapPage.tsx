import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { getCoverageFacilities, type Facility } from "@/api/coverage";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoverageMapPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("All");
  const [vaccine, setVaccine] = useState("All");
  const [period, setPeriod] = useState("All");
  const [selected, setSelected] = useState<Facility | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getCoverageFacilities()
      .then(setFacilities)
      .catch(() => setError("Failed to load facility data. Please try again."))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading facilities…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8 text-primary" />
          Geospatial Coverage Map
        </h1>
        <p className="text-muted-foreground mt-1">
          Facility-level immunization coverage rates and vaccine stock status across regions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Country</label>
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
              <label className="text-sm font-medium">Vaccine</label>
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
              <label className="text-sm font-medium">Period</label>
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
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {filtered.length} of {facilities.length} facilities
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Avg Coverage</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: coverageColor(stats.avgCoverage) }}>
              {stats.avgCoverage}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">High \u226580%</p>
            <p className="text-2xl font-bold mt-0.5 text-green-600">{stats.high}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Medium 50\u201379%</p>
            <p className="text-2xl font-bold mt-0.5 text-amber-500">{stats.medium}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Low &lt;50%</p>
            <p className="text-2xl font-bold mt-0.5 text-red-500">{stats.low}</p>
          </CardContent>
        </Card>
      </div>

      {/* Map + Detail Panel */}
      <div className="flex gap-4">
        {/* Map */}
        <Card className="flex-1 overflow-hidden p-0">
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
                    <p style={{ fontSize: 12 }}>Coverage: <strong>{facility.coverageRate}%</strong></p>
                    <p style={{ fontSize: 12 }}>Stock: <strong>{facility.stockStatus}</strong></p>
                    <p style={{ fontSize: 12 }}>Vaccine: <strong>{facility.vaccineType}</strong></p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Card>

        {/* Detail panel */}
        <div className="w-72 flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Coverage Legend</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { label: "High \u226580%", color: "#22c55e" },
                { label: "Medium 50\u201379%", color: "#f59e0b" },
                { label: "Low <50%", color: "#ef4444" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: color, boxShadow: "0 0 0 1.5px #888" }}
                  />
                  {label}
                </div>
              ))}
            </CardContent>
          </Card>

          {selected ? (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm truncate">{selected.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Location</p>
                  <p className="font-medium">{selected.region}, {selected.country}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Coverage Rate</p>
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
                  <p className="text-muted-foreground text-xs">Stock Status</p>
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
                    <p className="text-muted-foreground text-xs">Vaccine</p>
                    <Badge variant="outline" className="mt-0.5 text-xs">{selected.vaccineType}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Period</p>
                    <p className="font-medium">{selected.period}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Doses Administered</p>
                  <p className="font-medium">{selected.dosesAdministered.toLocaleString()} / {selected.targetPopulation.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 pb-4 px-4">
                <p className="text-sm text-muted-foreground text-center">
                  Click a facility marker to see details
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Facilities ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(f)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
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
