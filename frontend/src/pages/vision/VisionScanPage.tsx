import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import CameraCapture from "@/components/vision/CameraCapture";
import VVMResult from "@/components/vision/VVMResult";
import ScanHistory from "@/components/vision/ScanHistory";
import { scanVVM, type VVMScanResult } from "@/api/vision";

export default function VisionScanPage() {
  const [result, setResult] = useState<VVMScanResult | null>(null);
  const [modelVersion, setModelVersion] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCapture = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await scanVVM(file);
      setResult(response.result);
      setModelVersion(response.model_version);
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Scan failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/vision">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">VVM Scan</h1>
          <p className="text-sm text-muted-foreground">
            Capture or upload a vaccine vial monitor image for AI classification
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <CameraCapture onCapture={handleCapture} disabled={loading} />

          {loading && (
            <div className="flex items-center justify-center py-8 border rounded-lg bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Classifying VVM indicator…</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-md">
              {error}
            </div>
          )}

          {result && <VVMResult result={result} modelVersion={modelVersion} />}
        </div>

        <div>
          <ScanHistory limit={10} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
