import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listIngestionJobs, type IngestionJob } from "@/api/supply";
import { listModelRuns, type ModelRun } from "@/api/forecasting";
import { Package, Activity, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed" ? "success"
    : status === "failed" ? "destructive"
    : status === "processing" || status === "running" ? "warning"
    : "outline";
  return <Badge variant={variant as never}>{status}</Badge>;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listIngestionJobs(10), listModelRuns(5)])
      .then(([j, r]) => {
        setJobs(j);
        setRuns(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const totalRows = jobs.reduce((sum, j) => sum + (j.rows_succeeded ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Supply Chain Overview</h1>
        <p className="text-muted-foreground mt-1">
          Real-time visibility into your vaccine supply chain
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingestion Jobs"
          value={jobs.length}
          subtitle="Last 10 jobs"
          icon={Activity}
        />
        <StatCard
          title="Records Ingested"
          value={totalRows.toLocaleString()}
          subtitle="Successful rows"
          icon={Package}
        />
        <StatCard
          title="Completed"
          value={completedJobs}
          subtitle="Successful jobs"
          icon={CheckCircle}
        />
        <StatCard
          title="Model Runs"
          value={runs.length}
          subtitle="Forecasting pipelines"
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent ingestion jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Ingestion Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : jobs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No ingestion jobs yet.</p>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 6).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {job.file_name ?? job.source.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(job.created_at), "MMM d, HH:mm")}
                        {job.rows_total != null && ` · ${job.rows_total} rows`}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent model runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model Training Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No model runs yet.</p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium font-mono">
                        {run.supply_item_id.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(run.created_at), "MMM d, HH:mm")}
                        {run.metrics?.mae != null &&
                          ` · MAE ${run.metrics.mae.toFixed(2)}`}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
