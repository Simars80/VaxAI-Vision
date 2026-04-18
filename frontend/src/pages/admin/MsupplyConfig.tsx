import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Database,
} from "lucide-react";
import {
  getMSupplyConfig,
  saveMSupplyConfig,
  testMSupplyConnection,
  getMSupplySyncStatus,
  triggerMSupplySync,
  type MSupplyTestResult,
  type MSupplySyncStatus,
} from "@/api/msupply";

/* ─── Connection Form ───────────────────────────────────────────────────── */

function ConnectionForm({
  onTestResult,
}: {
  onTestResult: (result: MSupplyTestResult | null) => void;
}) {
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMSupplyConfig()
      .then((cfg) => {
        if (cfg) {
          setServerUrl(cfg.serverUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setError(null);
    setSaveSuccess(false);
    if (!serverUrl.trim() || !apiKey.trim()) {
      setError("Server URL and API key are required.");
      return;
    }
    setSaving(true);
    try {
      await saveMSupplyConfig({
        serverUrl: serverUrl.trim(),
        apiKey: apiKey.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setError(null);
    onTestResult(null);
    if (!serverUrl.trim() || !apiKey.trim()) {
      setError("Server URL and API key are required to test.");
      return;
    }
    setTesting(true);
    try {
      const result = await testMSupplyConnection({
        serverUrl: serverUrl.trim(),
        apiKey: apiKey.trim(),
      });
      onTestResult(result);
    } catch {
      onTestResult({ success: false, message: "Network error — could not reach the server." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Connection Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Server URL</label>
          <Input
            placeholder="https://msupply.example.org"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Full base URL of your mSupply server
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">API Key</label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="ms_live_••••••••"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pe-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            API key from your mSupply admin panel
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            Configuration saved successfully.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving || testing}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Config
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={saving || testing}>
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Test Result Banner ────────────────────────────────────────────────── */

function TestResultBanner({ result }: { result: MSupplyTestResult }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm ${
        result.success
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {result.success ? (
        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
      ) : (
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
      )}
      <div>
        <p className="font-medium">
          {result.success ? "Connection successful" : "Connection failed"}
        </p>
        <p className="text-xs mt-0.5 opacity-80">{result.message}</p>
        {result.serverInfo && (
          <p className="text-xs mt-0.5 opacity-80">Server: {result.serverInfo}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Sync Controls ─────────────────────────────────────────────────────── */

function SyncControls() {
  const [syncStatus, setSyncStatus] = useState<MSupplySyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    getMSupplySyncStatus()
      .then(setSyncStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await triggerMSupplySync();
      fetchStatus();
      if (!result.success) {
        setSyncError(`Sync completed with ${result.recordsFailed} failed records.`);
      }
    } catch {
      setSyncError("Sync request failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync Controls
          </CardTitle>
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Now
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sync status…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Last Sync</p>
                  <p className="text-sm font-medium">
                    {syncStatus?.lastSyncTime
                      ? new Date(syncStatus.lastSyncTime).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                <Database className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Records Synced</p>
                  <p className="text-sm font-medium">
                    {(syncStatus?.recordsCreated ?? 0) + (syncStatus?.recordsUpdated ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-sm font-medium text-destructive">
                    {syncStatus?.recordsFailed ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {syncStatus?.inProgress && (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sync in progress…
              </div>
            )}

            {syncError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {syncError}
              </div>
            )}

            {syncStatus?.errorMessage && (
              <div className="text-xs font-mono bg-muted/40 rounded px-3 py-1.5 text-muted-foreground">
                {syncStatus.errorMessage}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function MsupplyConfigPage() {
  const [testResult, setTestResult] = useState<MSupplyTestResult | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">Integration</Badge>
        </div>
        <h1 className="text-3xl font-bold">mSupply</h1>
        <p className="text-muted-foreground mt-1">
          Connect to your mSupply instance to sync stock data, requisitions, and facility information.
        </p>
      </div>

      {testResult && <TestResultBanner result={testResult} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ConnectionForm onTestResult={setTestResult} />
        </div>
        <SyncControls />
      </div>
    </div>
  );
}
