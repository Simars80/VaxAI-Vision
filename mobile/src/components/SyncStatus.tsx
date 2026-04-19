import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore, type SyncStatus as SyncStatusType } from "@/store/sync";

/**
 * Header icon showing online/offline/syncing status and pending queue count.
 * Tap to manually trigger a sync.
 */
export function SyncStatus() {
  const { status, pendingCount, isSyncing, sync } = useSyncStore();

  if (status === "unknown") return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={sync}
      activeOpacity={0.7}
    >
      <StatusIcon status={status} isSyncing={isSyncing} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 99 ? "99+" : pendingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatusIcon({ status, isSyncing }: { status: SyncStatusType; isSyncing: boolean }) {
  if (isSyncing) {
    return <ActivityIndicator size="small" color="#0ea5e9" style={styles.icon} />;
  }

  const iconMap: Record<SyncStatusType, { name: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
    online: { name: "cloud-done-outline", color: "#22c55e" },
    offline: { name: "cloud-offline-outline", color: "#94a3b8" },
    syncing: { name: "cloud-upload-outline", color: "#0ea5e9" },
    unknown: { name: "cloud-outline", color: "#94a3b8" },
  };

  const { name, color } = iconMap[status];
  return <Ionicons name={name} size={22} color={color} style={styles.icon} />;
}

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {},
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: "#f97316",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
