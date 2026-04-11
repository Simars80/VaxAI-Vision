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
  ArrowRightLeft,
  Clock,
  Database,
} from "lucide-react";
import {
  getDhis2Config,
  saveDhis2Config,
  testDhis2Connection,
  getDhis2Mappings,
  getDhis2SyncStatus,
  triggerDhis2Sync,
  type Dhis2FieldMapping,
  type Dhis2SyncStatus,
  type Dhis2TestResult,
} from "@/api/dhis2";

// ─── Connection Form ──────────────────────────────────────────────────────────

function ConnectionForm({
  onTestResult,
}: {
  onTestResult: (result: Dhis2TestResult | null) => void;
}) {
  const [instanceUrl, setInstanceUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDhis2Config()
      .then((cfg) => {
        if (cfg) {
          setInstanceUrl(cfg.instanceUrl);
          setUsername(cfg.username);
          // Password is not returned for security; leave blank
        }
      })
      .catch(() => {
        // No existing config; form starts empty
      });
  }, []);

  const handleSave = async () => {
    setError(null);
    setSaveSuccess(false);
    if (!instanceUrl.trim() || !username.trim()) {
      setError("Instance URL and username are required.");
      return;
    }
    setSaving(true);
    try {
      await saveDhis2Config({ instanceUrl: instanceUrl.trim(), username: username.trim(), password });
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
    if (!instanceUrl.trim() || !username.trim()) {
      setError("Instance URL and username are required to test.");
      return;
    }
    setTesting(true);
    try {
      const result = await testDhis2Connection({
        instanceUrl: instanceUrl.trim(),
        username: username.trim(),
        password,
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
          DHIS2 Connection Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Instance URL</label>
          <Input
            placeholder="https://play.dhis2.org/40.4.0"
            value={instanceUrl}
            onChange={(e) => setInstanceUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Full URL of the DHIS2 instance (e.g. https://dhis2.example.org)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Username</label>
          <Input
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Password</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank to keep the existing saved password
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
            Save Configuration
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

// ─── Test Connection Result ───────────────────────────────────────────────────

function TestResultBanner({ result }: { result: Dhis2TestResult }) {
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
        {result.serverVersion && (
          <p className="text-xs mt-0.5 opacity-80">
            DHIS2 version: {result.serverVersion}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Data Mapping Preview ─────────────────────────────────────────────────────

function MappingPreview() {
  const [mappings, setMappings] = useState<Dhis2FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDhis2Mappings()
      .then(setMappings)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Data Mapping Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading mappings...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Could not load mappings. Save and test connection first.
          </div>
        ) : mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No mappings configured. Connect to a DHIS2 instance first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-muted-foreground">DHIS2 Element</th>
                  <th className="pb-2 font-medium text-muted-foreground">VaxAI Field</th>
                  <th className="pb-2 font-medium text-muted-foreground">Type</th>
                  <th className="pb-2 font-medium text-muted-foreground text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappings.map((m) => (
                  <tr key={m.dhis2Element} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5">
                      <p className="font-medium">{m.dhis2ElementName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.dhis2Element}</p>
                    </td>
                    <td className="py-2.5">
                      <p>{m.vaxaiFieldLabel}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.vaxaiField}</p>
                    </td>
                    <td className="py-2.5">
                      <Badge variant="secondary" className="text-xs">{m.dataType}</Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      {m.enabled ? (
                        <Badge variant="success" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Disabled</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sync Controls ────────────────────────────────────────────────────────────

function SyncControls() {
  const [syncStatus, setSyncStatus] = useState<Dhis2SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    getDhis2SyncStatus()
      .then(setSyncStatus)
      .catch(() => {
        // Status endpoint not available yet
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await triggerDhis2Sync();
      // Refresh status after sync completes
      fetchStatus();
      if (!result.success) {
        setSyncError(`Sync completed with ${result.recordsFailed} errors.`);
      }
    } catch {
      setSyncError("Failed to trigger sync. Check connection settings.");
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
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
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
            Loading sync status...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sync status cards */}
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
                  <p className="text-sm font-medium">{syncStatus?.recordsSynced ?? 0}</p>
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
                Sync in progress...
              </div>
            )}

            {syncError && (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {syncError}
              </div>
            )}

            {/* Error log */}
            {syncStatus?.errors && syncStatus.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Errors</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {syncStatus.errors.map((err, i) => (
                    <div
                      key={i}
                      className="text-xs font-mono bg-muted/40 rounded px-3 py-1.5 text-muted-foreground"
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Dhis2ConfigPage() {
  const [testResult, setTestResult] = useState<Dhis2TestResult | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">DHIS2 Integration</h1>
        <p className="text-muted-foreground mt-1">
          Configure the connection to your DHIS2 instance for data synchronization
        </p>
      </div>

      {testResult && <TestResultBanner result={testResult} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ConnectionForm onTestResult={setTestResult} />
          <SyncControls />
        </div>
        <MappingPreview />
      </div>
    </div>
  );
}
