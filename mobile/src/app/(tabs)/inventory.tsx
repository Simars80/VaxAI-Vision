import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInventoryStore } from "@/store/inventory";
import { useSyncStore } from "@/store/sync";
import { OfflineBanner } from "@/components/OfflineBanner";
import { StockCard } from "@/components/StockCard";
import type { StockLevelItem, StockAdjustment } from "@/api/inventory";

export default function InventoryScreen() {
  const { stockSummary, supplyItems, loading, fetchStockSummary, fetchSupplyItems, adjustStock } =
    useInventoryStore();
  const { status } = useSyncStore();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "critical" | "low" | "adequate">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockLevelItem | null>(null);

  useEffect(() => {
    fetchStockSummary();
    fetchSupplyItems();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStockSummary({ forceRefresh: true }),
      fetchSupplyItems({ forceRefresh: true }),
    ]);
    setRefreshing(false);
  }, []);

  // Flatten and filter items
  const allItems = stockSummary?.facilities.flatMap((f) =>
    f.items.map((item) => ({ ...item, facilityName: f.facility_name, facilityId: f.facility_id })),
  ) ?? [];

  const filtered = allItems.filter((item) => {
    const matchesSearch =
      search.trim() === "" ||
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  function openAdjustModal(item: StockLevelItem) {
    setSelectedItem(item);
    setAdjustModalVisible(true);
  }

  return (
    <View style={styles.root}>
      <OfflineBanner />

      {/* Summary bar */}
      {stockSummary && (
        <View style={styles.summaryBar}>
          <SummaryChip
            label="Critical"
            count={stockSummary.critical_count}
            color="#ef4444"
            active={filterStatus === "critical"}
            onPress={() => setFilterStatus(filterStatus === "critical" ? "all" : "critical")}
          />
          <SummaryChip
            label="Low"
            count={stockSummary.low_count}
            color="#f97316"
            active={filterStatus === "low"}
            onPress={() => setFilterStatus(filterStatus === "low" ? "all" : "low")}
          />
          <SummaryChip
            label="OK"
            count={stockSummary.adequate_count}
            color="#22c55e"
            active={filterStatus === "adequate"}
            onPress={() => setFilterStatus(filterStatus === "adequate" ? "all" : "adequate")}
          />
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search vaccines..."
            placeholderTextColor="#94a3b8"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {loading && !stockSummary ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => `${item.supply_item_id}-${idx}`}
          renderItem={({ item }) => (
            <StockCard
              item={item}
              onAdjust={() => openAdjustModal(item)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No items match your search</Text>
            </View>
          }
        />
      )}

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        visible={adjustModalVisible}
        item={selectedItem}
        onClose={() => {
          setAdjustModalVisible(false);
          setSelectedItem(null);
        }}
        onSubmit={async (adjustment) => {
          const ok = await adjustStock(adjustment);
          if (ok) {
            setAdjustModalVisible(false);
            setSelectedItem(null);
            Alert.alert(
              "Stock Updated",
              status === "offline"
                ? "Adjustment queued for sync when online."
                : "Stock adjusted successfully.",
            );
          }
        }}
      />
    </View>
  );
}

// ── AdjustStockModal ──────────────────────────────────────────────────────────

function AdjustStockModal({
  visible,
  item,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  item: StockLevelItem | null;
  onClose: () => void;
  onSubmit: (adjustment: StockAdjustment) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [transactionType, setTransactionType] = useState<StockAdjustment["transaction_type"]>("receipt");
  const [lotNumber, setLotNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;

  async function handleSubmit() {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty === 0) {
      Alert.alert("Invalid Quantity", "Please enter a non-zero quantity.");
      return;
    }
    setSubmitting(true);
    await onSubmit({
      supply_item_id: item!.supply_item_id,
      facility_id: "default", // TODO: get from facility context
      quantity: qty,
      transaction_type: transactionType,
      lot_number: lotNumber.trim() || undefined,
    });
    setSubmitting(false);
    setQuantity("");
    setLotNumber("");
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Adjust Stock</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <Text style={modalStyles.itemName}>{item.name}</Text>
        <Text style={modalStyles.currentStock}>
          Current: {item.current_stock} {item.unit_of_measure ?? "units"}
        </Text>

        {/* Transaction type */}
        <Text style={modalStyles.label}>Type</Text>
        <View style={modalStyles.typeRow}>
          {(["receipt", "issue", "adjustment", "loss"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                modalStyles.typeChip,
                transactionType === t && modalStyles.typeChipActive,
              ]}
              onPress={() => setTransactionType(t)}
            >
              <Text
                style={[
                  modalStyles.typeChipText,
                  transactionType === t && modalStyles.typeChipTextActive,
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={modalStyles.label}>Quantity</Text>
        <TextInput
          style={modalStyles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="e.g. 50"
          placeholderTextColor="#94a3b8"
        />

        <Text style={modalStyles.label}>Lot Number (optional)</Text>
        <TextInput
          style={modalStyles.input}
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="e.g. LOT-2024-001"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[modalStyles.submitButton, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={modalStyles.submitButtonText}>Save Adjustment</Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── SummaryChip ───────────────────────────────────────────────────────────────

function SummaryChip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipCount, active && { color: "#fff" }]}>{count}</Text>
      <Text style={[styles.chipLabel, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  summaryBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chip: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipCount: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  chipLabel: { fontSize: 11, color: "#64748b", marginTop: 1 },
  searchRow: { padding: 12, backgroundColor: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: "#0f172a" },
  list: { padding: 12 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#64748b", fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { color: "#94a3b8", fontSize: 15, marginTop: 12 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  itemName: { fontSize: 18, fontWeight: "600", color: "#0f172a", marginBottom: 4 },
  currentStock: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  typeChipActive: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  typeChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  typeChipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
