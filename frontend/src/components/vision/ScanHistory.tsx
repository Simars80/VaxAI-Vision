import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Eye } from "lucide-react";
import { getScanHistory, VVM_STAGE_INFO, type ScanHistoryItem } from "@/api/vision";

interface ScanHistoryProps {
  facilityId?: string;
  limit?: number;
  refreshKey?: number;
}

export default function ScanHistory({ facilityId, limit = 20, refreshKey }: ScanHistoryProps) {
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getScanHistory(facilityId, limit)
      .then((data) => {
        setScans(data.scans);
        setError(null);
      })
      .catch(() => setError("Failed to load scan history"))
      .finally(() => setLoading(false));
  }, [facilityId, limit, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading scan history…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Recent Scans
          </CardTitle>
          <span className="text-xs text-muted-foreground">{scans.length} scans</span>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-3">{error}</div>
        )}

        {scans.length === 0 && !error ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No scans recorded yet. Scan a VVM indicator to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 px-2 font-medium">Facility</th>
                  <th className="text-start py-2 px-2 font-medium">Result</th>
                  <th className="text-start py-2 px-2 font-medium">Confidence</th>
                  <th className="text-start py-2 px-2 font-medium">Status</th>
                  <th className="text-start py-2 px-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => {
                  const info = VVM_STAGE_INFO[scan.classification];
                  return (
                    <tr key={scan.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 px-2">{scan.facility_name}</td>
                      <td className="py-2.5 px-2">
                        <Badge
                          variant="outline"
                          className="gap-1 font-medium"
                          style={{ borderColor: info.color, color: info.color }}
                        >
                          {info.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 tabular-nums">
                        {Math.round(scan.confidence * 100)}%
                      </td>
                      <td className="py-2.5 px-2">
                        {scan.usable ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Usable
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-3.5 w-3.5" /> Discard
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">
                        {new Date(scan.scanned_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
