import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Camera, Wrench, CheckCircle, XCircle, Loader2, Activity } from "lucide-react";
import ScanHistory from "@/components/vision/ScanHistory";
import { getModelStatus, getScanHistory, type ModelStatusEntry, type ScanHistoryItem } from "@/api/vision";

export default function VisionDashboardPage() {
  const [models, setModels] = useState<ModelStatusEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, usable: 0, unusable: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getModelStatus(), getScanHistory(undefined, 100)])
      .then(([modelData, historyData]) => {
        setModels(modelData);
        const usable = historyData.scans.filter((s: ScanHistoryItem) => s.usable).length;
        setStats({
          total: historyData.total,
          usable,
          unusable: historyData.total - usable,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="h-8 w-8 text-primary" /> Vision
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered vaccine vial monitoring and equipment inspection
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/vision/scan">
            <Button>
              <Camera className="h-4 w-4 mr-2" /> New VVM Scan
            </Button>
          </Link>
          <Link to="/vision/equipment">
            <Button variant="outline">
              <Wrench className="h-4 w-4 mr-2" /> Equipment Check
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Scans</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
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
                    <p className="text-xs text-muted-foreground">Usable</p>
                    <p className="text-2xl font-bold text-green-600">{stats.usable}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unusable</p>
                    <p className="text-2xl font-bold text-destructive">{stats.unusable}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Models Active</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {models.filter((m) => m.loaded).length}/{models.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ScanHistory limit={15} />
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">AI Models</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {models.map((model) => (
                    <div key={model.name} className="flex items-center justify-between p-3 rounded-md border">
                      <div>
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">
                          v{model.version} · {model.backend}
                        </p>
                      </div>
                      <Badge variant={model.loaded ? "success" : "destructive"}>
                        {model.loaded ? "Active" : "Offline"}
                      </Badge>
                    </div>
                  ))}
                  {models.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No model status available
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link to="/vision/scan" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Camera className="h-4 w-4" /> Scan VVM Indicator
                    </Button>
                  </Link>
                  <Link to="/vision/equipment" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Wrench className="h-4 w-4" /> Inspect Equipment
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
