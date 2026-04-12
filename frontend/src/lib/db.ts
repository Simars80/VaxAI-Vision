import Dexie, { type EntityTable } from "dexie";

export interface CachedInventory {
  id: string;
  facilityId: string;
  vaccine: string;
  stockLevel: number;
  lastUpdated: string;
  cachedAt: number;
}

export interface CachedColdChain {
  id: string;
  facilityId: string;
  equipmentId: string;
  temperature: number;
  status: string;
  lastUpdated: string;
  cachedAt: number;
}

export interface CachedCoverage {
  id: string;
  facilityId: string;
  lat: number;
  lng: number;
  coverageRate: number;
  lastUpdated: string;
  cachedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  body: string;
  createdAt: number;
  retries: number;
}

const db = new Dexie("VaxAIVisionDB") as Dexie & {
  inventory: EntityTable<CachedInventory, "id">;
  coldChain: EntityTable<CachedColdChain, "id">;
  coverage: EntityTable<CachedCoverage, "id">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
};

db.version(1).stores({
  inventory: "id, facilityId, cachedAt",
  coldChain: "id, facilityId, cachedAt",
  coverage: "id, facilityId, cachedAt",
  syncQueue: "++id, endpoint, createdAt",
});

export { db };
