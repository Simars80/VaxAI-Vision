import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getStockLevels,
  listSupplyItems,
  recordStockAdjustment,
  type StockSummary,
  type SupplyItem,
  type StockAdjustment,
} from "@/api/inventory";
import { enqueueRequest } from "@/api/client";

// ── Cache config ──────────────────────────────────────────────────────────────
const CACHE_KEYS = {
  STOCK_SUMMARY: "vaxai_cache_stock_summary",
  SUPPLY_ITEMS: "vaxai_cache_supply_items",
} as const;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryState {
  stockSummary: StockSummary | null;
  supplyItems: SupplyItem[];
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;

  fetchStockSummary: (opts?: { forceRefresh?: boolean; facilityId?: string }) => Promise<void>;
  fetchSupplyItems: (opts?: { forceRefresh?: boolean; category?: string }) => Promise<void>;
  adjustStock: (adjustment: StockAdjustment) => Promise<boolean>;
  clearError: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockSummary: null,
  supplyItems: [],
  loading: false,
  error: null,
  lastSyncedAt: null,

  fetchStockSummary: async ({ forceRefresh = false, facilityId } = {}) => {
    // Try cache first
    if (!forceRefresh) {
      const cached = await readCache<StockSummary>(CACHE_KEYS.STOCK_SUMMARY);
      if (cached) {
        set({ stockSummary: cached.data, lastSyncedAt: cached.cachedAt });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const data = await getStockLevels({ facility_id: facilityId });
      await writeCache(CACHE_KEYS.STOCK_SUMMARY, data);
      set({ stockSummary: data, loading: false, lastSyncedAt: Date.now() });
    } catch (err: unknown) {
      // Fall back to stale cache on error
      const stale = await (async () => {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEYS.STOCK_SUMMARY);
          return raw ? (JSON.parse(raw) as CacheEntry<StockSummary>) : null;
        } catch {
          return null;
        }
      })();

      if (stale) {
        set({ stockSummary: stale.data, loading: false, lastSyncedAt: stale.cachedAt });
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to load stock levels";
        set({ loading: false, error: message });
      }
    }
  },

  fetchSupplyItems: async ({ forceRefresh = false, category } = {}) => {
    if (!forceRefresh) {
      const cached = await readCache<SupplyItem[]>(CACHE_KEYS.SUPPLY_ITEMS);
      if (cached) {
        set({ supplyItems: cached.data });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const items = await listSupplyItems({ category });
      await writeCache(CACHE_KEYS.SUPPLY_ITEMS, items);
      set({ supplyItems: items, loading: false });
    } catch (err: unknown) {
      const stale = await (async () => {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEYS.SUPPLY_ITEMS);
          return raw ? (JSON.parse(raw) as CacheEntry<SupplyItem[]>) : null;
        } catch {
          return null;
        }
      })();

      if (stale) {
        set({ supplyItems: stale.data, loading: false });
      } else {
        const message = err instanceof Error ? err.message : "Failed to load supply items";
        set({ loading: false, error: message });
      }
    }
  },

  adjustStock: async (adjustment) => {
    try {
      await recordStockAdjustment(adjustment);
      // Invalidate cache so next fetch gets fresh data
      await AsyncStorage.removeItem(CACHE_KEYS.STOCK_SUMMARY);
      // Optimistic: re-fetch in background
      get().fetchStockSummary({ forceRefresh: true });
      return true;
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof Error && err.message.toLowerCase().includes("network");
      if (isNetworkError) {
        // Queue for later sync
        await enqueueRequest("/inventory/transactions", "POST", adjustment);
        return true; // Queued = success from UX perspective
      }
      const message = err instanceof Error ? err.message : "Failed to adjust stock";
      set({ error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
