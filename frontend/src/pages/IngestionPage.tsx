import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadCsv, listIngestionJobs, type IngestionJob } from "@/api/supply";
import { Upload, RefreshCw, Download, Package, Thermometer, Map } from "lucide-react";
import { format } from "date-fns";

/* ─── Data types users can import ──────────────────────────────────────── */

interface DataType {
  id: string;
  label: string;
  icon: React.ElementType;
  emoji: string;
  description: string;
  columns: string[];
}

const DATA_TYPES: DataType[] = [
  {
    id: "inventory",
    label: "Vaccine Inventory",
    icon: Package,
    emoji: "📦",
    description:
      "Upload current stock levels for each facility. Include vaccine name, quantity on hand, lot number, and expiry date.",
    columns: [
      "facility_name",
      "vaccine_name",
      "lot_number",
      "quantity_on_hand",
      "expiry_date",
      "date_recorded",
    ],
  },
  {
    id: "cold-chain",
    label: "Cold Chain Readings",
    icon: Thermometer,
    emoji: "❄️",
    description:
      "Upload temperature logs from cold storage equipment. Include timestamps, sensor ID, and temperature in Celsius.",
    columns: [
      "facility_name",
      "equipment_id",
      "sensor_id",
      "temperature_celsius",
      "timestamp",
      "alert_triggered",
    ],
  },
  {
    id: "coverage",
    label: "Coverage Data",
    icon: Map,
    emoji: "🗺️",
    description:
      "Upload immunisation coverage figures per facility, including doses administered and target population.",
    columns: [
      "facility_name",
      "vaccine_name",
      "doses_administered",
      "target_population",
      "period",
      "country",
      "region",
    ],
  },
];

/* ─── Status badge ──────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "partial"
          ? "warning"
          : "outline";
  return <Badge variant={variant as never}>{status}</Badge>;
}

/* ─── Template download (generates a CSV header row) ────────────────────── */

function downloadTemplate(dt: DataType) {
  const csv = dt.columns.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vaxai_${dt.id}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function IngestionPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("inventory");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadJobs = () => {
    setLoading(true);
    listIngestionJobs(20)
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadCsv(file);
      loadJobs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const activeType = DATA_TYPES.find((d) => d.id === selectedType) ?? DATA_TYPES[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Import Facility Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload vaccine inventory, cold chain readings, or coverage data from
          your facility systems. Choose a data type below, download the template,
          fill it in, and upload.
        </p>
      </div>

      {/* Step 1 — Choose data type */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Step 1 — Select Data Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DATA_TYPES.map((dt) => {
            const isActive = selectedType === dt.id;
            return (
              <button
                key={dt.id}
                type="button"
                onClick={() => setSelectedType(dt.id)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{dt.emoji}</span>
                <p className="font-semibold text-sm mt-2">{dt.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {dt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Format guidance + upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Step 2 — Upload {activeType.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Expected columns */}
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Expected CSV columns:</p>
            <div className="flex flex-wrap gap-2">
              {activeType.columns.map((col) => (
                <code
                  key={col}
                  className="text-xs bg-background border rounded px-2 py-1 font-mono"
                >
                  {col}
                </code>
              ))}
            </div>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(activeType)}
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>

          {/* Upload area */}
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="min-w-36"
            >
              {uploading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading…" : "Upload CSV / Excel"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Max 10 MB · CSV or Excel format
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Import history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Import History</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobs}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No imports yet. Upload a file above to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-start">
                    <th className="pb-2 pe-4 font-medium">Source</th>
                    <th className="pb-2 pe-4 font-medium">File</th>
                    <th className="pb-2 pe-4 font-medium">Status</th>
                    <th className="pb-2 pe-4 font-medium">Rows</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-2 pe-4">
                        <Badge variant="outline">{job.source}</Badge>
                      </td>
                      <td className="py-2 pe-4 max-w-48 truncate text-muted-foreground">
                        {job.file_name ?? "—"}
                      </td>
                      <td className="py-2 pe-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-2 pe-4 tabular-nums">
                        {job.rows_total != null ? (
                          <span>
                            <span className="text-green-600">
                              {job.rows_succeeded ?? 0}
                            </span>
                            {" / "}
                            {job.rows_total}
                            {(job.rows_failed ?? 0) > 0 && (
                              <span className="text-destructive ms-1">
                                ({job.rows_failed} failed)
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {format(new Date(job.created_at), "MMM d, HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
