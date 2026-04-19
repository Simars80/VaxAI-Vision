import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useInventoryStore } from "@/store/inventory";
import { useSyncStore, getCacheAge } from "@/store/sync";
import { getColdChainAlerts, type ColdChainAlert } from "@/api/coldchain";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AlertCard } from "@/components/AlertCard";
import { StockCard } from "@/components/StockCard";

export default function DashboardScreen() {
  const router = useRouter();
  const { stockSummary, fetchStockSummary, lastSyncedAt } = useInventoryStore();
  const { status } = useSyncStore();
  const [alerts, setAlerts] = useState<ColdChainAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStockSummary();
    loadAlerts();
  }, []);

  async function loadAlerts() {
    try {
      const data = await getColdChainAlerts(undefined, false);
      setAlerts(data.alerts.slice(0, 5));
    } catch {
      // Silently fail — alerts are best-effort
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([fetchStockSummary({ forceRefresh: true }), loadAlerts()]);
    setRefreshing(false);
  }

  const criticalCount = stockSummary?.critical_count ?? 0;
  const lowCount = stockSummary?.low_count ?? 0;
  const totalFacilities = stockSummary?.total_facilities ?? 0;
  const totalVaccines = stockSummary?.total_vaccines ?? 0;

  // Flatten all items for display
  const allItems = stockSummary?.facilities.flatMap((f) => f.items) ?? [];
  const criticalItems = allItems.filter((i) => i.status === "critical").slice(0, 3);

  return (
    <View style={styles.root}>
      <OfflineBanner />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Supply Chain Overview</Text>
          {lastSyncedAt && (
            <Text style={styles.greetingSubtitle}>
              Updated {getCacheAge(lastSyncedAt)}
            </Text>
          )}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <KPICard
            label="Facilities"
            value={totalFacilities}
            icon="business-outline"
            color="#0ea5e9"
          />
          <KPICard
            label="Vaccine Types"
            value={totalVaccines}
            icon="medical-outline"
            color="#8b5cf6"
          />
        </View>
        <View style={styles.kpiRow}>
          <KPICard
            label="Critical"
            value={criticalCount}
            icon="warning-outline"
            color="#ef4444"
            highlight={criticalCount > 0}
          />
          <KPICard
            label="Low Stock"
            value={lowCount}
            icon="alert-circle-outline"
            color="#f97316"
            highlight={lowCount > 0}
          />
        </View>

        {/* Active Cold Chain Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Alerts</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/cold-chain")}>
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </View>
        )}

        {/* Critical Stock Items */}
        {criticalItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Critical Stock</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/inventory")}>
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            {criticalItems.map((item) => (
              <StockCard key={item.supply_item_id} item={item} />
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <QuickAction
              icon="scan-outline"
              label="Scan VVM"
              onPress={() => router.push("/(tabs)/scan")}
              color="#0ea5e9"
            />
            <QuickAction
              icon="add-circle-outline"
              label="Adjust Stock"
              onPress={() => router.push("/(tabs)/inventory")}
              color="#8b5cf6"
            />
            <QuickAction
              icon="thermometer-outline"
              label="Cold Chain"
              onPress={() => router.push("/(tabs)/cold-chain")}
              color="#ef4444"
            />
          </View>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, highlight && { borderColor: color, borderWidth: 1.5 }]}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.kpiValue, highlight && { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { padding: 16 },
  greeting: { marginBottom: 16 },
  greetingTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  greetingSubtitle: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 0,
    borderColor: "transparent",
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  sectionLink: {
    fontSize: 13,
    color: "#0ea5e9",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    textAlign: "center",
  },
  bottomPad: { height: 24 },
});
