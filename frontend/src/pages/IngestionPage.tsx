import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadCsv, listIngestionJobs, type IngestionJob } from "@/api/supply";
import { Upload, RefreshCw } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed" ? "success"
    : status === "failed" ? "destructive"
    : status === "partial" ? "warning"
    : "outline";
  return <Badge variant={variant as never}>{status}</Badge>;
}

export default function IngestionPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("ingestion.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("ingestion.subtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
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
              {uploading ? t("ingestion.uploading") : t("ingestion.uploadCsvExcel")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("ingestion.maxFileSize")}
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mt-3">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("ingestion.ingestionJobs")}</CardTitle>
          <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading && jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("ingestion.noJobsYet")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-start">
                    <th className="pb-2 pe-4 font-medium">{t("ingestion.source")}</th>
                    <th className="pb-2 pe-4 font-medium">{t("ingestion.fileUrl")}</th>
                    <th className="pb-2 pe-4 font-medium">{t("common.status")}</th>
                    <th className="pb-2 pe-4 font-medium">{t("ingestion.rows")}</th>
                    <th className="pb-2 font-medium">{t("ingestion.created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30">
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
                            <span className="text-green-600">{job.rows_succeeded ?? 0}</span>
                            {" / "}
                            {job.rows_total}
                            {(job.rows_failed ?? 0) > 0 && (
                              <span className="text-destructive ms-1">
                                ({job.rows_failed} {t("common.failed")})
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
