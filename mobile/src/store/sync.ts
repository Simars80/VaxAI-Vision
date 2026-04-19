import { create } from "zustand";
import NetInfo from "@react-native-community/netinfo";
import { apiClient, getOfflineQueue, saveOfflineQueue, type QueuedRequest } from "@/api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = "online" | "offline" | "syncing" | "unknown";

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  error: string | null;

  /** Initialize network listener — call once in root layout */
  init: () => () => void;
  /** Manually trigger a sync of the offline queue */
  sync: () => Promise<void>;
  /** Refresh the pending count from storage */
  refreshPendingCount: () => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSyncStore = create<SyncState>((set, get) => ({
  status: "unknown",
  pendingCount: 0,
  lastSyncedAt: null,
  isSyncing: false,
  error: null,

  init: () => {
    // Refresh pending count on start
    get().refreshPendingCount();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      const newStatus: SyncStatus = isConnected ? "online" : "offline";
      const prev = get().status;

      set({ status: newStatus });

      // Auto-sync when coming back online
      if (isConnected && prev === "offline") {
        get().sync();
      }
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      set({ status: state.isConnected ? "online" : "offline" });
      if (state.isConnected) {
        get().sync();
      }
    });

    return unsubscribe;
  },

  refreshPendingCount: async () => {
    const queue = await getOfflineQueue();
    set({ pendingCount: queue.length });
  },

  sync: async () => {
    const { isSyncing, status } = get();
    if (isSyncing || status === "offline") return;

    set({ isSyncing: true, status: "syncing", error: null });

    let flushed = 0;
    try {
      const queue = await getOfflineQueue();
      if (queue.length === 0) {
        set({ isSyncing: false, status: "online", pendingCount: 0, lastSyncedAt: Date.now() });
        return;
      }

      const remaining: QueuedRequest[] = [];

      for (const item of queue) {
        try {
          await apiClient.request({
            url: item.endpoint,
            method: item.method,
            data: JSON.parse(item.body),
          });
          flushed++;
        } catch {
          // Increment retries; drop if exceeded max
          const updated: QueuedRequest = { ...item, retries: item.retries + 1 };
          if (updated.retries <= 5) {
            remaining.push(updated);
          }
          // Stop processing on first real failure (preserve order)
          break;
        }
      }

      // Keep items that weren't processed (after the failure) + remaining
      const processedCount = flushed + (queue.length - remaining.length - flushed > 0 ? 1 : 0);
      const notProcessed = queue.slice(processedCount + remaining.length);
      await saveOfflineQueue([...remaining, ...notProcessed]);

      set({
        isSyncing: false,
        status: "online",
        pendingCount: remaining.length + notProcessed.length,
        lastSyncedAt: Date.now(),
      });
    } catch {
      set({ isSyncing: false, status: "offline", error: "Sync failed — will retry when online" });
    }
  },
}));

// ── Convenience hook ──────────────────────────────────────────────────────────

export function isOnline(status: SyncStatus): boolean {
  return status === "online" || status === "syncing";
}

export function getCacheAge(cachedAt: number): string {
  const diff = Date.now() - cachedAt;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function isStale(cachedAt: number, thresholdMs = 3_600_000): boolean {
  return Date.now() - cachedAt > thresholdMs;
}
