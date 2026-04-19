import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getColdChainAlerts,
  getColdChainReadings,
  resolveAlert,
  type ColdChainAlert,
  type ColdChainReading,
} from "@/api/coldchain";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AlertCard } from "@/components/AlertCard";
import { TemperatureGauge } from "@/components/TemperatureGauge";

type Tab = "alerts" | "readings";

export default function ColdChainScreen() {
  const [tab, setTab] = useState<Tab>("alerts");
  const [alerts, setAlerts] = useState<ColdChainAlert[]>([]);
  const [readings, setReadings] = useState<ColdChainReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadData();
  }, [showResolved]);

  async function loadData() {
    setLoading(true);
    try {
      const [alertsData, readingsData] = await Promise.all([
        getColdChainAlerts(undefined, showResolved ? undefined : false),
        getColdChainReadings(),
      ]);
      setAlerts(alertsData.alerts);
      setReadings(readingsData.slice(0, 50)); // Latest 50 readings
    } catch (err) {
      console.error("Failed to load cold chain data", err);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [showResolved]);

  async function handleResolveAlert(alertId: string) {
    Alert.alert("Resolve Alert", "Mark this alert as resolved?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Resolve",
        style: "destructive",
        onPress: async () => {
          try {
            await resolveAlert(alertId);
            setAlerts((prev) => prev.filter((a) => a.id !== alertId));
          } catch {
            Alert.alert("Error", "Failed to resolve alert. Try again.");
          }
        },
      },
    ]);
  }

  // Summary stats
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");
  const warningAlerts = activeAlerts.filter((a) => a.severity === "warning");

  const breachReadings = readings.filter((r) => r.status === "breach");
  const warningReadings = readings.filter((r) => r.status === "warning");
  const normalReadings = readings.filter((r) => r.status === "normal");

  return (
    <View style={styles.root}>
      <OfflineBanner />

      {/* Status summary */}
      <View style={styles.statusBar}>
        <StatusPill
          count={criticalAlerts.length}
          label="Critical"
          color="#ef4444"
        />
        <StatusPill
          count={warningAlerts.length}
          label="Warning"
          color="#f97316"
        />
        <StatusPill
          count={normalReadings.length}
          label="Normal"
          color="#22c55e"
        />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TabButton
          label="Alerts"
          active={tab === "alerts"}
          badge={activeAlerts.length}
          onPress={() => setTab("alerts")}
        />
        <TabButton
          label="Readings"
          active={tab === "readings"}
          onPress={() => setTab("readings")}
        />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading cold chain data...</Text>
        </View>
      ) : tab === "alerts" ? (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              onResolve={!item.resolved ? () => handleResolveAlert(item.id) : undefined}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setShowResolved(!showResolved)}
            >
              <Ionicons
                name={showResolved ? "eye-off-outline" : "eye-outline"}
                size={16}
                color="#64748b"
              />
              <Text style={styles.toggleText}>
                {showResolved ? "Hide resolved" : "Show resolved"}
              </Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
              <Text style={styles.emptyTitle}>No active alerts</Text>
              <Text style={styles.emptySubtitle}>All cold chain systems are operating normally</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={readings}
          keyExtractor={(item, idx) => `${item.sensor_id}-${item.timestamp}-${idx}`}
          renderItem={({ item }) => <ReadingRow reading={item} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#f1f5f9" }} />}
          ListHeaderComponent={
            <View style={styles.gaugeContainer}>
              <TemperatureGauge
                readings={readings.slice(0, 5)}
                label="Latest Readings"
              />
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="thermometer-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No readings available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadingRow({ reading }: { reading: ColdChainReading }) {
  const statusColor =
    reading.status === "breach"
      ? "#ef4444"
      : reading.status === "warning"
      ? "#f97316"
      : "#22c55e";

  const formattedTime = new Date(reading.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedDate = new Date(reading.timestamp).toLocaleDateString();

  return (
    <View style={readingStyles.row}>
      <View style={[readingStyles.dot, { backgroundColor: statusColor }]} />
      <View style={readingStyles.info}>
        <Text style={readingStyles.sensor}>{reading.sensor_id}</Text>
        <Text style={readingStyles.time}>
          {formattedDate} {formattedTime}
        </Text>
      </View>
      <Text style={[readingStyles.temp, { color: statusColor }]}>
        {reading.temp_celsius.toFixed(1)}°C
      </Text>
    </View>
  );
}

function StatusPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[pillStyles.pill, { borderColor: `${color}40` }]}>
      <Text style={[pillStyles.count, { color }]}>{count}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  badge,
  onPress,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[tabStyles.tab, active && tabStyles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  statusBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  list: { padding: 12 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#64748b", fontSize: 14 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  toggleText: { fontSize: 13, color: "#64748b" },
  gaugeContainer: { marginBottom: 12 },
});

const readingStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  info: { flex: 1 },
  sensor: { fontSize: 14, fontWeight: "500", color: "#0f172a" },
  time: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  temp: { fontSize: 18, fontWeight: "700" },
});

const pillStyles = StyleSheet.create({
  pill: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    backgroundColor: "#f8fafc",
  },
  count: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 11, color: "#64748b", marginTop: 1 },
});

const tabStyles = StyleSheet.create({
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  tabActive: { backgroundColor: "#0ea5e9" },
  label: { fontSize: 14, fontWeight: "500", color: "#64748b" },
  labelActive: { color: "#fff" },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});
