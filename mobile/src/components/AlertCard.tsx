import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import type { ColdChainAlert } from "@/api/coldchain";

interface AlertCardProps {
  alert: ColdChainAlert;
  onResolve?: () => void;
  compact?: boolean;
}

/**
 * Displays a cold chain alert in a card format.
 * Supports a compact variant for dashboard previews.
 */
export function AlertCard({ alert, onResolve, compact = false }: AlertCardProps) {
  const isCritical = alert.severity === "critical";
  const isHigh = alert.alert_type === "high";

  const borderColor = isCritical ? "#ef4444" : "#f97316";
  const bgColor = isCritical ? "#fef2f2" : "#fff7ed";
  const iconColor = isCritical ? "#ef4444" : "#f97316";

  const startedAgo = formatDistanceToNow(new Date(alert.start_time), { addSuffix: true });
  const tempDiff = Math.abs(alert.peak_temp_celsius - alert.threshold_celsius).toFixed(1);

  if (compact) {
    return (
      <View style={[compactStyles.card, { borderLeftColor: borderColor }]}>
        <Ionicons
          name={isHigh ? "thermometer" : "snow-outline"}
          size={18}
          color={iconColor}
        />
        <View style={compactStyles.info}>
          <Text style={compactStyles.facility} numberOfLines={1}>
            {alert.facility_name}
          </Text>
          <Text style={compactStyles.detail}>
            {alert.peak_temp_celsius.toFixed(1)}°C ({isHigh ? "+" : "-"}{tempDiff}°C)
          </Text>
        </View>
        <View style={[compactStyles.badge, { backgroundColor: borderColor }]}>
          <Text style={compactStyles.badgeText}>
            {isCritical ? "Critical" : "Warning"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderLeftColor: borderColor, backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}18` }]}>
            <Ionicons
              name={isHigh ? "thermometer" : "snow-outline"}
              size={20}
              color={iconColor}
            />
          </View>
          <View>
            <Text style={styles.facilityName} numberOfLines={1}>
              {alert.facility_name}
            </Text>
            <Text style={styles.country}>{alert.country}</Text>
          </View>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.severityText}>
            {isCritical ? "Critical" : "Warning"}
          </Text>
        </View>
      </View>

      {/* Temperature info */}
      <View style={styles.tempRow}>
        <TempStat
          label="Peak Temp"
          value={`${alert.peak_temp_celsius.toFixed(1)}°C`}
          color={iconColor}
        />
        <TempStat
          label="Threshold"
          value={`${alert.threshold_celsius}°C`}
          color="#64748b"
        />
        <TempStat
          label="Deviation"
          value={`${isHigh ? "+" : "-"}${tempDiff}°C`}
          color={iconColor}
        />
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Sensor: {alert.sensor_id}
        </Text>
        <Text style={styles.metaText}>{startedAgo}</Text>
      </View>

      {/* Resolve button */}
      {onResolve && !alert.resolved && (
        <TouchableOpacity style={styles.resolveBtn} onPress={onResolve} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#64748b" />
          <Text style={styles.resolveText}>Mark Resolved</Text>
        </TouchableOpacity>
      )}

      {alert.resolved && (
        <View style={styles.resolvedBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          <Text style={styles.resolvedText}>Resolved</Text>
        </View>
      )}
    </View>
  );
}

function TempStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.tempStat}>
      <Text style={[styles.tempValue, { color }]}>{value}</Text>
      <Text style={styles.tempLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  facilityName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  country: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  severityText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  tempRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  tempStat: {
    flex: 1,
    alignItems: "center",
  },
  tempValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  tempLabel: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 1,
    textAlign: "center",
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  resolveText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  resolvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  resolvedText: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "500",
  },
});

const compactStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderLeftWidth: 3,
    padding: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  info: { flex: 1 },
  facility: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  detail: { fontSize: 12, color: "#64748b", marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
