import { useState } from "react";
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
import { Thermometer, AlertTriangle, CheckCircle, Snowflake } from "lucide-react";

// ─── Mock data ────────────────────────────────────────────────────────────────

interface SensorReading {
  time: string;
  temp: number;
}

interface BreachEvent {
  id: string;
  unitId: string;
  startTime: string;
  endTime: string | null;
  peakTemp: number;
  type: "high" | "low";
}

interface StorageUnit {
  id: string;
  name: string;
  location: string;
  currentTemp: number;
  minTemp: number;
  maxTemp: number;
  thresholdLow: number;
  thresholdHigh: number;
  status: "ok" | "warning" | "breach";
  readings: SensorReading[];
}

function generateReadings(
  baseTemp: number,
  count: number,
  anomalyAt?: number,
): SensorReading[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const minutesAgo = (count - 1 - i) * 10;
    const label = new Date(now - minutesAgo * 60_000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    let temp = baseTemp + (Math.random() - 0.5) * 1.2;
    if (anomalyAt != null && i >= anomalyAt && i < anomalyAt + 4) {
      temp += 3.5 + Math.random() * 1.5;
    }
    return { time: label, temp: parseFloat(temp.toFixed(1)) };
  });
}

const STORAGE_UNITS: StorageUnit[] = [
  {
    id: "unit-1",
    name: "Fridge A",
    location: "Warehouse 1 – North Bay",
    currentTemp: 4.2,
    minTemp: 2.8,
    maxTemp: 5.9,
    thresholdLow: 2.0,
    thresholdHigh: 8.0,
    status: "ok",
    readings: generateReadings(4.5, 18),
  },
  {
    id: "unit-2",
    name: "Freezer B",
    location: "Warehouse 1 – South Bay",
    currentTemp: -18.4,
    minTemp: -20.1,
    maxTemp: -15.8,
    thresholdLow: -25.0,
    thresholdHigh: -15.0,
    status: "warning",
    readings: generateReadings(-18.5, 18, 12),
  },
  {
    id: "unit-3",
    name: "Fridge C",
    location: "Clinic Annex",
    currentTemp: 9.1,
    minTemp: 2.4,
    maxTemp: 9.1,
    thresholdLow: 2.0,
    thresholdHigh: 8.0,
    status: "breach",
    readings: generateReadings(4.0, 18, 14),
  },
  {
    id: "unit-4",
    name: "Cold Room D",
    location: "Warehouse 2",
    currentTemp: 3.6,
    minTemp: 3.0,
    maxTemp: 5.1,
    thresholdLow: 2.0,
    thresholdHigh: 8.0,
    status: "ok",
    readings: generateReadings(3.8, 18),
  },
];

const BREACH_EVENTS: BreachEvent[] = [
  {
    id: "br-1",
    unitId: "unit-3",
    startTime: "09:20",
    endTime: null,
    peakTemp: 9.1,
    type: "high",
  },
  {
    id: "br-2",
    unitId: "unit-2",
    startTime: "08:50",
    endTime: "09:10",
    peakTemp: -14.3,
    type: "high",
  },
  {
    id: "br-3",
    unitId: "unit-1",
    startTime: "06:30",
    endTime: "06:40",
    peakTemp: 8.4,
    type: "high",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StorageUnit["status"] }) {
  if (status === "ok")
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" /> OK
      </Badge>
    );
  if (status === "warning")
    return (
      <Badge variant="warning" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Warning
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> Breach
    </Badge>
  );
}

function TempDisplay({
  label,
  value,
  unit = "°C",
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {value > 0 ? "+" : ""}
        {value}
        {unit}
      </p>
    </div>
  );
}

function UnitCard({
  unit,
  selected,
  onClick,
}: {
  unit: StorageUnit;
  selected: boolean;
  onClick: () => void;
}) {
  const borderColor =
    unit.status === "breach"
      ? "border-destructive"
      : unit.status === "warning"
        ? "border-yellow-400"
        : "border-border";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border-2 p-4 transition-all hover:shadow-md ${borderColor} ${
        selected ? "bg-primary/5 shadow-md" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-sm">{unit.name}</p>
          <p className="text-xs text-muted-foreground">{unit.location}</p>
        </div>
        <StatusBadge status={unit.status} />
      </div>

      <div className="flex items-center justify-around">
        <TempDisplay label="Min" value={unit.minTemp} />
        <div className="text-center">
          <Snowflake className="h-4 w-4 text-blue-400 mx-auto mb-0.5" />
          <p className="text-xs text-muted-foreground">Current</p>
          <p className="text-2xl font-bold tabular-nums text-primary">
            {unit.currentTemp > 0 ? "+" : ""}
            {unit.currentTemp}°C
          </p>
        </div>
        <TempDisplay label="Max" value={unit.maxTemp} />
      </div>

      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
        <span>Safe: {unit.thresholdLow}°C – {unit.thresholdHigh}°C</span>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ColdChainPage() {
  const [selectedUnitId, setSelectedUnitId] = useState(STORAGE_UNITS[0].id);

  const selectedUnit = STORAGE_UNITS.find((u) => u.id === selectedUnitId)!;
  const unitBreaches = BREACH_EVENTS.filter((b) => b.unitId === selectedUnit.id);

  const totalBreaches = BREACH_EVENTS.filter((b) => b.endTime === null).length;
  const okUnits = STORAGE_UNITS.filter((u) => u.status === "ok").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cold Chain Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Real-time temperature readings for vaccine cold storage units
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{STORAGE_UNITS.length}</p>
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
                <p className="text-xs text-muted-foreground">In Range</p>
                <p className="text-2xl font-bold text-green-600">{okUnits}</p>
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
                <p className="text-xs text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {STORAGE_UNITS.filter((u) => u.status === "warning").length}
                </p>
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
                <p className="text-xs text-muted-foreground">Active Breaches</p>
                <p className="text-2xl font-bold text-destructive">{totalBreaches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unit list */}
        <div className="space-y-3">
          {STORAGE_UNITS.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              selected={unit.id === selectedUnitId}
              onClick={() => setSelectedUnitId(unit.id)}
            />
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Temperature chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {selectedUnit.name} — Last 3 Hours
                </CardTitle>
                <StatusBadge status={selectedUnit.status} />
              </div>
              <p className="text-xs text-muted-foreground">{selectedUnit.location}</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={selectedUnit.readings}
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
                    formatter={(val: number) => [`${val}°C`, "Temperature"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <ReferenceLine
                    y={selectedUnit.thresholdHigh}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Max ${selectedUnit.thresholdHigh}°C`, fontSize: 10, fill: "#ef4444" }}
                  />
                  <ReferenceLine
                    y={selectedUnit.thresholdLow}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{ value: `Min ${selectedUnit.thresholdLow}°C`, fontSize: 10, fill: "#3b82f6" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="Temperature"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Breach event timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Breach Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {unitBreaches.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  No breach events recorded for this unit today.
                </div>
              ) : (
                <div className="space-y-3">
                  {unitBreaches.map((breach) => (
                    <div
                      key={breach.id}
                      className={`flex items-center gap-4 p-3 rounded-md border ${
                        breach.endTime === null
                          ? "bg-destructive/5 border-destructive/30"
                          : "bg-muted/30"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          breach.endTime === null ? "bg-destructive" : "bg-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {breach.type === "high" ? "High temp breach" : "Low temp breach"}
                          </span>
                          {breach.endTime === null && (
                            <Badge variant="destructive" className="text-xs py-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {breach.startTime}
                          {breach.endTime ? ` – ${breach.endTime}` : " – ongoing"}
                          {" · "}Peak: {breach.peakTemp > 0 ? "+" : ""}
                          {breach.peakTemp}°C
                          {" · "}Threshold: {breach.type === "high"
                            ? `${selectedUnit.thresholdHigh}°C`
                            : `${selectedUnit.thresholdLow}°C`}
                        </p>
                      </div>
                      <AlertTriangle
                        className={`h-4 w-4 flex-shrink-0 ${
                          breach.endTime === null ? "text-destructive" : "text-muted-foreground"
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
