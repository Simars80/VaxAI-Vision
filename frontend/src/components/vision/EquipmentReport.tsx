import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Loader2, Wrench } from "lucide-react";
import CameraCapture from "./CameraCapture";
import { inspectEquipment, type EquipmentInspectionResult } from "@/api/vision";

export default function EquipmentReport() {
  const [result, setResult] = useState<EquipmentInspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await inspectEquipment(file);
      setResult(response.result);
    } catch {
      setError("Failed to inspect equipment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = result?.status === "operational" ? "#22c55e"
    : result?.status === "needs_maintenance" ? "#eab308"
    : "#ef4444";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Equipment Inspection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Capture a photo of cold chain equipment (refrigerator, cold box, vaccine carrier)
            to check for visible damage or maintenance needs.
          </p>
          <CameraCapture onCapture={handleCapture} disabled={loading} />

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Analyzing equipment condition…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-2" style={{ borderColor: statusColor + "40" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Inspection Result</CardTitle>
              <Badge
                style={{
                  backgroundColor: statusColor + "20",
                  color: statusColor,
                  borderColor: statusColor + "60",
                }}
              >
                {result.status === "operational" ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Operational</>
                ) : (
                  <><AlertTriangle className="h-3 w-3 mr-1" /> {result.status}</>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg p-4" style={{ backgroundColor: statusColor + "08" }}>
              <p className="text-sm">{result.details}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
