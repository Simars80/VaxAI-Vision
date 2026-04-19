import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Cache entry format ────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  /** Optional: ISO date string of last server-side update (for selective sync) */
  serverUpdatedAt?: string;
  /** Whether this entry has local mutations not yet synced */
  isDirty?: boolean;
}

// ── Prefix convention: all VaxAI cache keys share a namespace ─────────────────
const PREFIX = "vaxai_offline_";

export function cacheKey(namespace: string, id?: string): string {
  return id ? `${PREFIX}${namespace}_${id}` : `${PREFIX}${namespace}`;
}

// ── Core read/write ───────────────────────────────────────────────────────────

export async function cacheWrite<T>(
  key: string,
  data: T,
  serverUpdatedAt?: string,
): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    cachedAt: Date.now(),
    serverUpdatedAt,
    isDirty: false,
  };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

export async function cacheRead<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

// ── TTL-aware read ────────────────────────────────────────────────────────────

/**
 * Read from cache only if it's within the TTL window.
 * Returns null if missing or expired.
 */
export async function cacheReadFresh<T>(
  key: string,
  ttlMs: number,
): Promise<CacheEntry<T> | null> {
  const entry = await cacheRead<T>(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ttlMs) return null;
  return entry;
}

/**
 * Read from cache regardless of TTL (stale fallback).
 * Useful when offline — stale > nothing.
 */
export async function cacheReadStale<T>(key: string): Promise<CacheEntry<T> | null> {
  return cacheRead<T>(key);
}

// ── Dirty flag (local mutations pending sync) ─────────────────────────────────

export async function markDirty(key: string): Promise<void> {
  const entry = await cacheRead<unknown>(key);
  if (!entry) return;
  entry.isDirty = true;
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

export async function clearDirty(key: string): Promise<void> {
  const entry = await cacheRead<unknown>(key);
  if (!entry) return;
  entry.isDirty = false;
  entry.cachedAt = Date.now();
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

// ── Selective sync helpers ────────────────────────────────────────────────────

/**
 * Returns true if the entry should be synced from server —
 * either because it's expired or because the server has a newer version.
 */
export function needsSync(
  entry: CacheEntry<unknown>,
  ttlMs: number,
  serverUpdatedAt?: string,
): boolean {
  const isExpired = Date.now() - entry.cachedAt > ttlMs;
  if (isExpired) return true;
  if (serverUpdatedAt && entry.serverUpdatedAt) {
    return new Date(serverUpdatedAt) > new Date(entry.serverUpdatedAt);
  }
  return false;
}

// ── Bulk cache management ─────────────────────────────────────────────────────

/** Returns all cache keys that belong to VaxAI namespace */
export async function getAllCacheKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return (all as string[]).filter((k) => k.startsWith(PREFIX));
}

/** Returns total byte estimate of cached data */
export async function getCacheSize(): Promise<number> {
  const keys = await getAllCacheKeys();
  let total = 0;
  for (const key of keys) {
    const val = await AsyncStorage.getItem(key);
    if (val) total += val.length * 2; // UTF-16 approx
  }
  return total;
}

/** Purge all VaxAI cache entries */
export async function clearAllCache(): Promise<void> {
  const keys = await getAllCacheKeys();
  await AsyncStorage.multiRemove(keys);
}

/** Purge only cache entries older than the given TTL */
export async function pruneExpiredCache(ttlMs: number): Promise<number> {
  const keys = await getAllCacheKeys();
  let pruned = 0;
  for (const key of keys) {
    const entry = await cacheRead<unknown>(key);
    if (entry && Date.now() - entry.cachedAt > ttlMs) {
      await cacheDelete(key);
      pruned++;
    }
  }
  return pruned;
}

// ── Human-readable age ────────────────────────────────────────────────────────

export function formatCacheAge(cachedAt: number): string {
  const diff = Date.now() - cachedAt;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
