import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle, Package, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type FacilityStockLevel, type StockSummary, getStockLevels } from "@/api/supply";

const STATUS_COLOR: Record<string, string> = {
  adequate: "#22c55e",
  low: "#f59e0b",
  critical: "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  adequate: "bg-green-100 text-green-800",
  low: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  adequate: CheckCircle,
  low: AlertTriangle,
  critical: XCircle,
};

function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] ?? Package;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BG[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FacilityChart({ facility }: { facility: FacilityStockLevel }) {
  const { t } = useTranslation();
  const data = facility.items.map((item) => ({
    name: item.name.length > 20 ? item.name.slice(0, 18) + "…" : item.name,
    fullName: item.name,
    stock: Math.max(0, item.current_stock),
    status: item.status,
    unit: item.unit_of_measure ?? t("common.units"),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="truncate">{facility.facility_name}</span>
          <span className="text-xs text-muted-foreground font-normal ms-2 shrink-0">
            {t("inventory.vaccines", { count: facility.items.length })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("inventory.noStockData")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value: number, _name: string, props: { payload?: { fullName?: string; unit?: string } }) => [
                  `${value.toLocaleString()} ${props.payload?.unit ?? t("common.units")}`,
                  props.payload?.fullName ?? t("inventory.currentStock"),
                ]}
              />
              <Bar dataKey="stock" name={t("inventory.currentStock")} radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={STATUS_COLOR[entry.status] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="mt-3 space-y-1">
          {facility.items.map((item) => (
            <div
              key={item.supply_item_id}
              className="flex items-center justify-between text-sm py-1 border-b last:border-0"
            >
              <span className="truncate me-2 text-muted-foreground">{item.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium">
                  {item.current_stock.toLocaleString()} {item.unit_of_measure ?? t("common.units")}
                </span>
                <StatusBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const DEMO_DATA: StockSummary = {
  total_facilities: 4,
  total_vaccines: 5,
  critical_count: 3,
  low_count: 4,
  adequate_count: 13,
  facilities: [
    {
      facility_id: "FAC-001",
      facility_name: "Central Vaccine Store",
      items: [
        { supply_item_id: "1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 1200, status: "adequate" },
        { supply_item_id: "2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 45, status: "low" },
        { supply_item_id: "3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 6, status: "critical" },
        { supply_item_id: "4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 320, status: "adequate" },
        { supply_item_id: "5", name: "Yellow Fever", category: "vaccine", unit_of_measure: "doses", current_stock: 80, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-002",
      facility_name: "District Health Clinic A",
      items: [
        { supply_item_id: "1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 55, status: "adequate" },
        { supply_item_id: "2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 12, status: "low" },
        { supply_item_id: "3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 3, status: "critical" },
        { supply_item_id: "4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 90, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-003",
      facility_name: "Rural Health Post B",
      items: [
        { supply_item_id: "1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 22, status: "low" },
        { supply_item_id: "2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 5, status: "critical" },
        { supply_item_id: "4", name: "Measles-Rubella", category: "vaccine", unit_of_measure: "doses", current_stock: 110, status: "adequate" },
      ],
    },
    {
      facility_id: "FAC-004",
      facility_name: "Regional Medical Center",
      items: [
        { supply_item_id: "1", name: "BCG Vaccine", category: "vaccine", unit_of_measure: "doses", current_stock: 500, status: "adequate" },
        { supply_item_id: "2", name: "OPV (Oral Polio)", category: "vaccine", unit_of_measure: "doses", current_stock: 200, status: "adequate" },
        { supply_item_id: "3", name: "Pentavalent (DPT-HepB-Hib)", category: "vaccine", unit_of_measure: "doses", current_stock: 75, status: "adequate" },
        { supply_item_id: "5", name: "Yellow Fever", category: "vaccine", unit_of_measure: "doses", current_stock: 30, status: "low" },
      ],
    },
  ],
};

export default function InventoryPage() {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const { t } = useTranslation();

  useEffect(() => {
    getStockLevels()
      .then((data) => {
        if (data.total_facilities === 0) {
          setSummary(DEMO_DATA);
          setUsingDemo(true);
        } else {
          setSummary(data);
        }
      })
      .catch(() => {
        setSummary(DEMO_DATA);
        setUsingDemo(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const facilitiesToShow = useMemo(() => {
    if (!summary) return [];
    if (selectedFacility === "all") return summary.facilities;
    return summary.facilities.filter((f) => f.facility_id === selectedFacility);
  }, [summary, selectedFacility]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("inventory.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("inventory.subtitle")}
        </p>
        {usingDemo && (
          <Badge variant="outline" className="mt-2 text-xs">
            {t("demo.dataBadge")}
          </Badge>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("inventory.loadingStock")}</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label={t("inventory.facilities")}
              value={summary.total_facilities}
              icon={Package}
              colorClass="bg-primary/10 text-primary"
            />
            <SummaryCard
              label={t("inventory.adequate")}
              value={summary.adequate_count}
              icon={CheckCircle}
              colorClass="bg-green-100 text-green-700"
            />
            <SummaryCard
              label={t("inventory.lowStock")}
              value={summary.low_count}
              icon={AlertTriangle}
              colorClass="bg-amber-100 text-amber-700"
            />
            <SummaryCard
              label={t("inventory.critical")}
              value={summary.critical_count}
              icon={XCircle}
              colorClass="bg-red-100 text-red-700"
            />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground font-medium">{t("common.status")}:</span>
            {Object.entries(STATUS_COLOR).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize">{status}</span>
              </span>
            ))}
          </div>

          {summary.facilities.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">{t("common.facility")}:</label>
              <select
                className="text-sm border rounded-md px-2 py-1 bg-background"
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
              >
                <option value="all">{t("common.allFacilities")}</option>
                {summary.facilities.map((f) => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.facility_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {facilitiesToShow.map((facility) => (
              <FacilityChart key={facility.facility_id} facility={facility} />
            ))}
          </div>

          {facilitiesToShow.length === 0 && (
            <p className="text-muted-foreground">{t("inventory.noDataForFacility")}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
