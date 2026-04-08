import { useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Filter, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Facility {
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

// ── Mock Data ─────────────────────────────────────────────────────────────────

const FACILITIES: Facility[] = [
  { id: "ng-1", name: "Lagos Central Clinic", country: "Nigeria", region: "Lagos", lat: 6.524, lng: 3.379, coverageRate: 87, stockStatus: "adequate", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 4320, targetPopulation: 4965 },
  { id: "ng-2", name: "Kano District Hospital", country: "Nigeria", region: "Kano", lat: 12.000, lng: 8.517, coverageRate: 52, stockStatus: "low", vaccineType: "DTP", period: "2024-Q4", dosesAdministered: 1980, targetPopulation: 3808 },
  { id: "ng-3", name: "Abuja PHC Centre", country: "Nigeria", region: "FCT", lat: 9.076, lng: 7.399, coverageRate: 74, stockStatus: "adequate", vaccineType: "BCG", period: "2024-Q4", dosesAdministered: 2960, targetPopulation: 4000 },
  { id: "ng-4", name: "Ibadan Health Post", country: "Nigeria", region: "Oyo", lat: 7.388, lng: 3.896, coverageRate: 38, stockStatus: "critical", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 760, targetPopulation: 2000 },
  { id: "ng-5", name: "Kaduna Rural Clinic", country: "Nigeria", region: "Kaduna", lat: 10.524, lng: 7.441, coverageRate: 61, stockStatus: "low", vaccineType: "MCV", period: "2024-Q4", dosesAdministered: 1525, targetPopulation: 2500 },
  { id: "ke-1", name: "Nairobi Immunization Hub", country: "Kenya", region: "Nairobi", lat: -1.286, lng: 36.817, coverageRate: 91, stockStatus: "adequate", vaccineType: "DTP", period: "2024-Q4", dosesAdministered: 9100, targetPopulation: 10000 },
  { id: "ke-2", name: "Mombasa Port Clinic", country: "Kenya", region: "Mombasa", lat: -4.043, lng: 39.668, coverageRate: 78, stockStatus: "adequate", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 3900, targetPopulation: 5000 },
  { id: "ke-3", name: "Kisumu District Health", country: "Kenya", region: "Kisumu", lat: -0.102, lng: 34.762, coverageRate: 45, stockStatus: "critical", vaccineType: "BCG", period: "2024-Q4", dosesAdministered: 1350, targetPopulation: 3000 },
  { id: "ke-4", name: "Nakuru County Hospital", country: "Kenya", region: "Nakuru", lat: -0.302, lng: 36.066, coverageRate: 83, stockStatus: "adequate", vaccineType: "MCV", period: "2024-Q4", dosesAdministered: 2490, targetPopulation: 3000 },
  { id: "et-1", name: "Addis Ababa Health Centre", country: "Ethiopia", region: "Addis Ababa", lat: 9.032, lng: 38.740, coverageRate: 69, stockStatus: "low", vaccineType: "DTP", period: "2024-Q4", dosesAdministered: 6900, targetPopulation: 10000 },
  { id: "et-2", name: "Dire Dawa PHC", country: "Ethiopia", region: "Dire Dawa", lat: 9.590, lng: 41.861, coverageRate: 42, stockStatus: "critical", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 1260, targetPopulation: 3000 },
  { id: "et-3", name: "Bahir Dar District Clinic", country: "Ethiopia", region: "Amhara", lat: 11.593, lng: 37.390, coverageRate: 56, stockStatus: "low", vaccineType: "BCG", period: "2024-Q4", dosesAdministered: 2800, targetPopulation: 5000 },
  { id: "gh-1", name: "Accra Central Hospital", country: "Ghana", region: "Greater Accra", lat: 5.556, lng: -0.197, coverageRate: 88, stockStatus: "adequate", vaccineType: "MCV", period: "2024-Q4", dosesAdministered: 4400, targetPopulation: 5000 },
  { id: "gh-2", name: "Kumasi Health Post", country: "Ghana", region: "Ashanti", lat: 6.688, lng: -1.624, coverageRate: 71, stockStatus: "adequate", vaccineType: "DTP", period: "2024-Q4", dosesAdministered: 2840, targetPopulation: 4000 },
  { id: "gh-3", name: "Tamale PHC", country: "Ghana", region: "Northern", lat: 9.403, lng: -0.839, coverageRate: 33, stockStatus: "critical", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 990, targetPopulation: 3000 },
  { id: "ug-1", name: "Kampala City Clinic", country: "Uganda", region: "Central", lat: 0.347, lng: 32.582, coverageRate: 80, stockStatus: "adequate", vaccineType: "BCG", period: "2024-Q4", dosesAdministered: 4000, targetPopulation: 5000 },
  { id: "ug-2", name: "Gulu District Hospital", country: "Uganda", region: "Northern", lat: 2.779, lng: 32.299, coverageRate: 49, stockStatus: "critical", vaccineType: "DTP", period: "2024-Q4", dosesAdministered: 1470, targetPopulation: 3000 },
  { id: "tz-1", name: "Dar es Salaam Hub", country: "Tanzania", region: "Dar es Salaam", lat: -6.792, lng: 39.208, coverageRate: 85, stockStatus: "adequate", vaccineType: "MCV", period: "2024-Q4", dosesAdministered: 8500, targetPopulation: 10000 },
  { id: "tz-2", name: "Dodoma Central Clinic", country: "Tanzania", region: "Dodoma", lat: -6.173, lng: 35.739, coverageRate: 60, stockStatus: "low", vaccineType: "OPV", period: "2024-Q4", dosesAdministered: 1800, targetPopulation: 3000 },
];

const ALL_COUNTRIES = ["All", ...Array.from(new Set(FACILITIES.map((f) => f.country))).sort()];
const ALL_VACCINES = ["All", ...Array.from(new Set(FACILITIES.map((f) => f.vaccineType))).sort()];
const ALL_PERIODS = ["All", ...Array.from(new Set(FACILITIES.map((f) => f.period))).sort()];

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
  const [country, setCountry] = useState("All");
  const [vaccine, setVaccine] = useState("All");
  const [period, setPeriod] = useState("All");
  const [selected, setSelected] = useState<Facility | null>(null);

  const filtered = useMemo(() => {
    return FACILITIES.filter(
      (f) =>
        (country === "All" || f.country === country) &&
        (vaccine === "All" || f.vaccineType === vaccine) &&
        (period === "All" || f.period === period),
    );
  }, [country, vaccine, period]);

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
                {ALL_COUNTRIES.map((c) => (
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
                {ALL_VACCINES.map((v) => (
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
                {ALL_PERIODS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {filtered.length} of {FACILITIES.length} facilities
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
