import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StockLevelItem } from "@/api/inventory";

interface StockCardProps {
  item: StockLevelItem & { facilityName?: string; facilityId?: string };
  onAdjust?: () => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  critical: {
    color: "#ef4444",
    bg: "#fef2f2",
    label: "Critical",
    icon: "warning" as const,
  },
  low: {
    color: "#f97316",
    bg: "#fff7ed",
    label: "Low",
    icon: "alert-circle" as const,
  },
  adequate: {
    color: "#22c55e",
    bg: "#f0fdf4",
    label: "Adequate",
    icon: "checkmark-circle" as const,
  },
};

/**
 * Displays a vaccine inventory item with stock level and status.
 * Optionally shows an adjust button.
 */
export function StockCard({ item, onAdjust, compact = false }: StockCardProps) {
  const config = STATUS_CONFIG[item.status];

  if (compact) {
    return (
      <View style={[compactStyles.card, { borderLeftColor: config.color }]}>
        <Ionicons name={config.icon} size={16} color={config.color} />
        <View style={compactStyles.info}>
          <Text style={compactStyles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={compactStyles.stock}>
            {item.current_stock} {item.unit_of_measure ?? "units"}
          </Text>
        </View>
        <View style={[compactStyles.badge, { backgroundColor: config.color }]}>
          <Text style={compactStyles.badgeText}>{config.label}</Text>
        </View>
      </View>
    );
  }

  // Stock bar fill (capped at 100%)
  const fillPct = Math.min(item.current_stock / 1000, 1); // Normalize to 1000 max

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={[styles.categoryDot, { backgroundColor: config.color }]} />
          <View style={styles.nameInfo}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.category}>{item.category}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {/* Facility (if present) */}
      {item.facilityName && (
        <View style={styles.facilityRow}>
          <Ionicons name="business-outline" size={12} color="#94a3b8" />
          <Text style={styles.facilityName} numberOfLines={1}>{item.facilityName}</Text>
        </View>
      )}

      {/* Stock level */}
      <View style={styles.stockRow}>
        <Text style={[styles.stockValue, { color: config.color }]}>
          {item.current_stock.toLocaleString()}
        </Text>
        <Text style={styles.stockUnit}>{item.unit_of_measure ?? "units"}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${fillPct * 100}%` as `${number}%`,
              backgroundColor: config.color,
            },
          ]}
        />
      </View>

      {/* Adjust button */}
      {onAdjust && (
        <TouchableOpacity style={styles.adjustBtn} onPress={onAdjust} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={16} color="#0ea5e9" />
          <Text style={styles.adjustText}>Adjust Stock</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nameInfo: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  category: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
    textTransform: "capitalize",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  facilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  facilityName: {
    fontSize: 12,
    color: "#94a3b8",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  stockValue: {
    fontSize: 26,
    fontWeight: "700",
  },
  stockUnit: {
    fontSize: 13,
    color: "#64748b",
  },
  barBg: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
  },
  adjustText: {
    fontSize: 13,
    color: "#0ea5e9",
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
  name: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  stock: { fontSize: 12, color: "#64748b", marginTop: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
