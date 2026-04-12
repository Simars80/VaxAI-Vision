import { useState, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Thermometer,
  Trash2,
  BarChart3,
  Share2,
} from "lucide-react";
import {
  getImpactReport,
  getImpactReportCsvUrl,
  type ImpactReportData,
  type ReportParams,
} from "@/api/reports";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const STOCK_COLORS: Record<string, string> = {
  adequate: "#22c55e",
  low: "#f59e0b",
  critical: "#ef4444",
};

export default function ImpactReportPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImpactReportData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [country, setCountry] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const params = useMemo((): ReportParams => {
    const p: ReportParams = {};
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    if (country) p.country = country;
    return p;
  }, [dateFrom, dateTo, country]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getImpactReport(params);
      setReport(data);
    } catch {
      setError(t("reports.reportError"));
    } finally {
      setLoading(false);
    }
  }, [params, t]);

  const downloadCsv = useCallback(() => {
    const url = getImpactReportCsvUrl(params);
    const token = localStorage.getItem("access_token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `vaxai_impact_report.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }, [params]);

  const downloadPdf = useCallback(() => {
    if (!reportRef.current) return;
    window.print();
  }, []);

  const shareReport = useCallback(async () => {
    if (!navigator.share) {
      await navigator.clipboard.writeText(window.location.href);
      return;
    }
    await navigator.share({
      title: t("reports.title"),
      text: t("reports.title"),
      url: window.location.href,
    });
  }, [t]);

  const coverageChartData = useMemo(
    () =>
      report?.coverageByCountry.map((c) => ({
        country: c.country,
        coverage: c.avgCoverageRate,
        doses: c.totalDosesAdministered,
      })) ?? [],
    [report],
  );

  const stockChartData = useMemo(
    () =>
      report?.stockSummary.map((s) => ({
        name: s.status,
        value: s.facilityCount,
      })) ?? [],
    [report],
  );

  const totalFacilities = useMemo(
    () => report?.coverageByCountry.reduce((s, c) => s + c.facilityCount, 0) ?? 0,
    [report],
  );

  const totalDoses = useMemo(
    () => report?.coverageByCountry.reduce((s, c) => s + c.totalDosesAdministered, 0) ?? 0,
    [report],
  );

  const avgCoverage = useMemo(() => {
    if (!report || report.coverageByCountry.length === 0) return 0;
    const total = report.coverageByCountry.reduce(
      (s, c) => s + c.avgCoverageRate * c.facilityCount,
      0,
    );
    return Math.round(total / totalFacilities);
  }, [report, totalFacilities]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            {t("reports.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("reports.subtitle")}
          </p>
        </div>
        {report && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={shareReport}>
              <Share2 className="h-4 w-4 me-1" />
              {t("common.share")}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="h-4 w-4 me-1" />
              {t("common.csv")}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPdf}>
              <Download className="h-4 w-4 me-1" />
              {t("common.pdf")}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("common.from")}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border rounded-md px-3 py-1.5 bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("common.to")}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border rounded-md px-3 py-1.5 bg-background"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("common.country")}</label>
              <input
                type="text"
                placeholder={t("common.allCountries")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="text-sm border rounded-md px-3 py-1.5 bg-background w-40"
              />
            </div>
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 me-1 animate-spin" />
                  {t("reports.generating")}
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 me-1" />
                  {t("reports.generateReport")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!report && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              {t("reports.emptyState")}
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <div ref={reportRef} className="space-y-6 print:space-y-4">
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold">{t("reports.printTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("reports.generated", { date: new Date(report.generatedAt).toLocaleDateString() })}
              {report.dateFrom && ` | ${t("reports.periodLabel", { from: report.dateFrom, to: report.dateTo ?? t("reports.present") })}`}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{t("reports.facilities")}</p>
                <p className="text-2xl font-bold mt-0.5">{totalFacilities}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {t("reports.avgCoverage")}
                </p>
                <p className="text-2xl font-bold mt-0.5 text-green-600">{avgCoverage}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{t("reports.dosesAdministered")}</p>
                <p className="text-2xl font-bold mt-0.5">{totalDoses.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Thermometer className="h-3 w-3" /> {t("reports.coldChainCompliance")}
                </p>
                <p className="text-2xl font-bold mt-0.5 text-blue-600">
                  {report.coldChain.complianceRate}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> {t("reports.wastageRate")}
                </p>
                <p className="text-2xl font-bold mt-0.5 text-amber-600">
                  {report.wastage.wastageRate}%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("reports.coverageByCountry")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={coverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="coverage" name={`${t("reports.coverage")} %`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("reports.stockDistribution")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={stockChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stockChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STOCK_COLORS[entry.name] ?? "#94a3b8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("reports.coldChainSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.totalReadings")}</span>
                  <span className="font-medium">{report.coldChain.totalReadings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.tempBreaches")}</span>
                  <span className="font-medium text-red-600">{report.coldChain.breachCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.complianceRate")}</span>
                  <span className="font-medium text-green-600">{report.coldChain.complianceRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.alertsTotal")}</span>
                  <span className="font-medium">
                    {report.coldChain.totalAlerts} / {report.coldChain.resolvedAlerts}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("reports.wastageSummary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.dosesWasted")}</span>
                  <span className="font-medium text-red-600">
                    {report.wastage.totalWastageQty.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.dosesIssued")}</span>
                  <span className="font-medium">{report.wastage.totalIssuedQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("reports.wastageRate")}</span>
                  <span className="font-medium text-amber-600">{report.wastage.wastageRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t("reports.facilityPerformance", { count: report.facilityPerformance.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-start px-4 py-2 font-medium">{t("common.facility")}</th>
                      <th className="text-start px-4 py-2 font-medium">{t("common.country")}</th>
                      <th className="text-start px-4 py-2 font-medium">{t("reports.region")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("reports.coverage")}</th>
                      <th className="text-start px-4 py-2 font-medium">{t("reports.stock")}</th>
                      <th className="text-start px-4 py-2 font-medium">{t("common.vaccine")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("reports.doses")}</th>
                      <th className="text-end px-4 py-2 font-medium">{t("reports.targetPop")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.facilityPerformance.map((f) => (
                      <tr key={f.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{f.name}</td>
                        <td className="px-4 py-2">{f.country}</td>
                        <td className="px-4 py-2">{f.region}</td>
                        <td className="px-4 py-2 text-end">
                          <span
                            className="font-medium"
                            style={{
                              color:
                                f.coverageRate >= 80
                                  ? "#22c55e"
                                  : f.coverageRate >= 50
                                    ? "#f59e0b"
                                    : "#ef4444",
                            }}
                          >
                            {f.coverageRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                            style={{
                              backgroundColor:
                                STOCK_COLORS[f.stockStatus]
                                  ? `${STOCK_COLORS[f.stockStatus]}20`
                                  : "#e2e8f0",
                              color: STOCK_COLORS[f.stockStatus] ?? "#64748b",
                            }}
                          >
                            {f.stockStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2">{f.vaccineType}</td>
                        <td className="px-4 py-2 text-end">
                          {f.dosesAdministered.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-end">
                          {f.targetPopulation.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
