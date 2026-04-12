import { db } from "./db";
import { apiClient } from "@/api/client";

let syncing = false;

export type SyncStatus = "online" | "offline" | "syncing";

const listeners = new Set<(status: SyncStatus) => void>();

export function onSyncStatusChange(cb: (status: SyncStatus) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notify(status: SyncStatus) {
  listeners.forEach((cb) => cb(status));
}

export async function enqueueOfflineChange(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
) {
  await db.syncQueue.add({
    endpoint,
    method,
    body: JSON.stringify(body),
    createdAt: Date.now(),
    retries: 0,
  });
}

export async function flushSyncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  notify("syncing");

  let flushed = 0;
  try {
    const items = await db.syncQueue.orderBy("createdAt").toArray();
    for (const item of items) {
      try {
        await apiClient.request({
          url: item.endpoint,
          method: item.method,
          data: JSON.parse(item.body),
        });
        await db.syncQueue.delete(item.id!);
        flushed++;
      } catch {
        await db.syncQueue.update(item.id!, { retries: item.retries + 1 });
        if (item.retries >= 5) {
          await db.syncQueue.delete(item.id!);
        }
        break;
      }
    }
  } finally {
    syncing = false;
    notify(navigator.onLine ? "online" : "offline");
  }
  return flushed;
}

export async function pendingCount(): Promise<number> {
  return db.syncQueue.count();
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

function handleOnline() {
  notify("online");
  flushSyncQueue();
}

function handleOffline() {
  notify("offline");
}

export function initSyncListeners() {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  if (navigator.onLine) {
    flushSyncQueue();
  }
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
