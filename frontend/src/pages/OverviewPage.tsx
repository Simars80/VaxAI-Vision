import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { listIngestionJobs, type IngestionJob } from "@/api/supply";
import { listModelRuns, type ModelRun } from "@/api/forecasting";
import {
  Package,
  Activity,
  CheckCircle,
  TrendingUp,
  Upload,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ─── Stat card (compact) ──────────────────────────────────────────────── */

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
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Feature navigation card ──────────────────────────────────────────── */

interface FeatureCardProps {
  emoji: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}

function FeatureCard({ emoji, title, description, href, cta }: FeatureCardProps) {
  return (
    <Link to={href} className="block group">
      <Card className="h-full transition-all duration-200 group-hover:border-primary group-hover:shadow-md group-hover:-translate-y-0.5">
        <CardContent className="pt-6 flex flex-col h-full">
          <span className="text-3xl mb-1">{emoji}</span>
          <h3 className="text-base font-bold mt-3 mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">
            {description}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-4">
            {cta} →
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

/* ─── Feature cards data ───────────────────────────────────────────────── */

const featureCards: FeatureCardProps[] = [
  {
    emoji: "📦",
    title: "Inventory Dashboard",
    description:
      "Monitor real-time stock levels across every facility — colour-coded as adequate, low, or critical.",
    href: "/inventory",
    cta: "View Inventory",
  },
  {
    emoji: "📊",
    title: "AI-Powered Forecasting",
    description:
      "Predict demand surges, flag expiring stock, and model what-if scenarios to order smarter.",
    href: "/forecast",
    cta: "View Forecasts",
  },
  {
    emoji: "❄️",
    title: "Cold Chain Monitor",
    description:
      "Live temperature readings with configurable alert thresholds and breach event timelines.",
    href: "/cold-chain",
    cta: "See Cold Chain",
  },
  {
    emoji: "🗺️",
    title: "Coverage Map",
    description:
      "Interactive map showing immunisation coverage and stock status per facility.",
    href: "/coverage-map",
    cta: "View Map",
  },
  {
    emoji: "🤖",
    title: "Vision AI",
    description:
      "AI models trained on vaccine packaging detect, classify, and count stock automatically.",
    href: "/vision",
    cta: "Explore Vision",
  },
  {
    emoji: "📤",
    title: "Data Ingestion",
    description:
      "Import facility data from CSV, Excel, or connect to DHIS2, OpenLMIS, and mSupply.",
    href: "/ingestion",
    cta: "Import Data",
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function OverviewPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([listIngestionJobs(10), listModelRuns(5)])
      .then(([j, r]) => {
        setJobs(j);
        setRuns(r);
      })
      .catch(console.error);
  }, []);

  const completedJobs = jobs.filter((j) => j.status === "completed").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const totalRows = jobs.reduce((sum, j) => sum + (j.rows_succeeded ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("overview.title")}</h1>
        <p className="text-muted-foreground mt-1">
          An end-to-end platform for vaccine supply chain intelligence — from
          cold storage to last-mile delivery.
        </p>
      </div>

      {/* KPI stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("overview.ingestionJobs")}
          value={jobs.length}
          subtitle={t("overview.last10Jobs")}
          icon={Activity}
        />
        <StatCard
          title={t("overview.recordsIngested")}
          value={totalRows.toLocaleString()}
          subtitle={t("overview.successfulRows")}
          icon={Package}
        />
        <StatCard
          title={t("overview.completed")}
          value={completedJobs}
          subtitle={
            failedJobs > 0
              ? `${failedJobs} ${t("common.failed")}`
              : t("common.noFailures")
          }
          icon={CheckCircle}
        />
        <StatCard
          title={t("overview.modelRuns")}
          value={runs.length}
          subtitle={t("overview.forecastingPipelines")}
          icon={TrendingUp}
        />
      </div>

      {/* Feature navigation cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((card) => (
            <FeatureCard key={card.href} {...card} />
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          to="/reports/impact"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-2"
        >
          <FileText className="h-4 w-4" />
          Impact Reports
        </Link>
        <Link
          to="/admin/dhis2"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-2"
        >
          <Upload className="h-4 w-4" />
          DHIS2 Integration
        </Link>
        <Link
          to="/admin/openlmis"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-2"
        >
          <Upload className="h-4 w-4" />
          OpenLMIS
        </Link>
        <Link
          to="/admin/msupply"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border rounded-md px-3 py-2"
        >
          <Upload className="h-4 w-4" />
          mSupply
        </Link>
      </div>
    </div>
  );
}
