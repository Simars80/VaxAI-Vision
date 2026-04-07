import { useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Facility {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  coverage: number; // 0–100
  stockStatus: "adequate" | "low" | "critical";
  vaccines: string[];
  population: number;
  lastUpdated: string;
}

const FACILITIES: Facility[] = [
  { id: "NG-KAN", name: "Kano Central Store",    country: "Nigeria",   lat: 12.002, lng: 8.592,   coverage: 82, stockStatus: "adequate", vaccines: ["bOPV", "PENTA", "PCV13"],            population: 38000, lastUpdated: "2026-04-05" },
  { id: "NG-LAG", name: "Lagos Logistics Hub",   country: "Nigeria",   lat: 6.524,  lng: 3.379,   coverage: 74, stockStatus: "adequate", vaccines: ["bOPV", "PENTA", "PCV13", "ROTA"],    population: 51000, lastUpdated: "2026-04-06" },
  { id: "NG-ABJ", name: "Abuja NPHCDA Depot",    country: "Nigeria",   lat: 9.058,  lng: 7.495,   coverage: 91, stockStatus: "adequate", vaccines: ["bOPV", "PENTA"],                     population: 44000, lastUpdated: "2026-04-06" },
  { id: "NG-KAD", name: "Kaduna District HC",    country: "Nigeria",   lat: 10.526, lng: 7.438,   coverage: 41, stockStatus: "critical", vaccines: ["bOPV"],                              population: 22000, lastUpdated: "2026-04-03" },
  { id: "NG-IBA", name: "Ibadan PHC Centre",     country: "Nigeria",   lat: 7.376,  lng: 3.947,   coverage: 63, stockStatus: "low",      vaccines: ["bOPV", "PENTA", "MR"],               population: 29000, lastUpdated: "2026-04-04" },
  { id: "KE-NBI", name: "Nairobi KEMSA Store",   country: "Kenya",     lat: -1.292, lng: 36.822,  coverage: 88, stockStatus: "adequate", vaccines: ["bOPV", "PENTA", "ROTA", "MR"],       population: 57000, lastUpdated: "2026-04-06" },
  { id: "KE-MBA", name: "Mombasa Cold Room",     country: "Kenya",     lat: -4.044, lng: 39.668,  coverage: 47, stockStatus: "low",      vaccines: ["bOPV", "PCV13"],                     population: 33000, lastUpdated: "2026-04-04" },
  { id: "KE-KSM", name: "Kisumu Regional Hub",   country: "Kenya",     lat: -0.092, lng: 34.768,  coverage: 61, stockStatus: "adequate", vaccines: ["bOPV", "PENTA", "PCV13", "ROTA"],    population: 24000, lastUpdated: "2026-04-05" },
  { id: "GH-ACC", name: "Accra District HQ",     country: "Ghana",     lat: 5.603,  lng: -0.187,  coverage: 85, stockStatus: "adequate", vaccines: ["bOPV", "PCV13", "MR", "PENTA"],      population: 44000, lastUpdated: "2026-04-06" },
  { id: "GH-KSI", name: "Kumasi Central HC",     country: "Ghana",     lat: 6.688,  lng: -1.624,  coverage: 67, stockStatus: "adequate", vaccines: ["bOPV", "PENTA"],                     population: 31000, lastUpdated: "2026-04-05" },
  { id: "GH-TAM", name: "Tamale North Clinic",   country: "Ghana",     lat: 9.403,  lng: -0.839,  coverage: 38, stockStatus: "critical", vaccines: ["bOPV"],                              population: 14000, lastUpdated: "2026-04-02" },
  { id: "TZ-DAR", name: "Dar es Salaam PHC",     country: "Tanzania",  lat: -6.776, lng: 39.178,  coverage: 81, stockStatus: "adequate", vaccines: ["bOPV", "PCV13", "BCG", "MR"],        population: 49000, lastUpdated: "2026-04-06" },
  { id: "TZ-DOD", name: "Dodoma Central HC",     country: "Tanzania",  lat: -6.173, lng: 35.738,  coverage: 58, stockStatus: "low",      vaccines: ["bOPV", "BCG"],                       population: 20000, lastUpdated: "2026-04-04" },
  { id: "ET-ADD", name: "Addis Ababa PHC",        country: "Ethiopia",  lat: 9.145,  lng: 40.489,  coverage: 76, stockStatus: "adequate", vaccines: ["bOPV", "PENTA", "MR", "PCV13"],      population: 62000, lastUpdated: "2026-04-05" },
  { id: "ET-MEK", name: "Mekelle District HC",   country: "Ethiopia",  lat: 13.496, lng: 39.476,  coverage: 32, stockStatus: "critical", vaccines: ["bOPV"],                              population: 11000, lastUpdated: "2026-04-01" },
  { id: "SN-DAK", name: "Dakar Central MCH",     country: "Senegal",   lat: 14.693, lng: -17.447, coverage: 83, stockStatus: "adequate", vaccines: ["bOPV", "PCV13", "MR", "PENTA"],      population: 37000, lastUpdated: "2026-04-06" },
];

const ALL_COUNTRIES = ["All Countries", ...Array.from(new Set(FACILITIES.map((f) => f.country))).sort()];
const ALL_VACCINES = ["All Vaccines", "bOPV", "PENTA", "PCV13", "ROTA", "BCG", "MR"];
const TIME_PERIODS = ["Last 7 days", "Last 30 days", "Last 90 days", "All time"];

function coverageColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#eab308";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

function stockBadgeCls(status: Facility["stockStatus"]): string {
  return status === "adequate"
    ? "bg-emerald-100 text-emerald-700"
    : status === "low"
    ? "bg-yellow-100 text-yellow-700"
    : "bg-red-100 text-red-700";
}

export default function CoverageMapPage() {
  const [country, setCountry] = useState("All Countries");
  const [vaccine, setVaccine] = useState("All Vaccines");
  const [timePeriod, setTimePeriod] = useState("Last 30 days");

  const filtered = useMemo(() =>
    FACILITIES.filter((f) => {
      if (country !== "All Countries" && f.country !== country) return false;
      if (vaccine !== "All Vaccines" && !f.vaccines.includes(vaccine)) return false;
      return true;
    }),
    [country, vaccine]
  );

  const summary = useMemo(() => {
    const total = filtered.length;
    const avg = total ? Math.round(filtered.reduce((s, f) => s + f.coverage, 0) / total) : 0;
    const critical = filtered.filter((f) => f.stockStatus === "critical").length;
    const low = filtered.filter((f) => f.stockStatus === "low").length;
    return { total, avg, critical, low };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Geospatial Coverage Map</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Facility-level immunization coverage and stock status across all regions
        </p>
      </div>

      {/* Filters + legend */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background" value={country} onChange={(e) => setCountry(e.target.value)}>
          {ALL_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background" value={vaccine} onChange={(e) => setVaccine(e.target.value)}>
          {ALL_VACCINES.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm bg-background" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)}>
          {TIME_PERIODS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {[
            { color: "#22c55e", label: "≥80%" },
            { color: "#eab308", label: "60–79%" },
            { color: "#f97316", label: "40–59%" },
            { color: "#ef4444", label: "<40%" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Facilities", value: String(summary.total), cls: "text-foreground" },
          { label: "Avg Coverage", value: `${summary.avg}%`, cls: summary.avg >= 80 ? "text-emerald-600" : summary.avg >= 60 ? "text-yellow-600" : "text-red-600" },
          { label: "Low Stock", value: String(summary.low), cls: "text-yellow-600" },
          { label: "Critical Stock", value: String(summary.critical), cls: "text-red-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Facility Coverage Map</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div style={{ height: "500px" }}>
            <MapContainer center={[5, 20]} zoom={4} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {filtered.map((f) => (
                <CircleMarker
                  key={f.id}
                  center={[f.lat, f.lng]}
                  radius={12}
                  pathOptions={{
                    fillColor: coverageColor(f.coverage),
                    fillOpacity: 0.85,
                    color: "#fff",
                    weight: 1.5,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</p>
                      <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>{f.country}</p>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <tbody>
                          <tr><td style={{ color: "#6b7280", paddingBottom: 2 }}>Coverage</td><td style={{ textAlign: "right", fontWeight: 600, color: coverageColor(f.coverage) }}>{f.coverage}%</td></tr>
                          <tr><td style={{ color: "#6b7280", paddingBottom: 2 }}>Stock</td><td style={{ textAlign: "right" }}>{f.stockStatus}</td></tr>
                          <tr><td style={{ color: "#6b7280", paddingBottom: 2 }}>Population</td><td style={{ textAlign: "right" }}>{f.population.toLocaleString()}</td></tr>
                          <tr><td style={{ color: "#6b7280", paddingBottom: 2 }}>Updated</td><td style={{ textAlign: "right" }}>{f.lastUpdated}</td></tr>
                        </tbody>
                      </table>
                      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Vaccines: {f.vaccines.join(", ")}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Facility table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility List ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left py-2 pr-4">Facility</th>
                  <th className="text-left py-2 pr-4">Country</th>
                  <th className="text-right py-2 pr-4">Coverage</th>
                  <th className="text-left py-2 pr-4">Stock</th>
                  <th className="text-left py-2 hidden sm:table-cell">Vaccines</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => a.coverage - b.coverage)
                  .map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 font-medium">{f.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{f.country}</td>
                      <td className="py-2 pr-4 text-right font-medium" style={{ color: coverageColor(f.coverage) }}>
                        {f.coverage}%
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stockBadgeCls(f.stockStatus)}`}>
                          {f.stockStatus}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs hidden sm:table-cell">
                        {f.vaccines.join(", ")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
