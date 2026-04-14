const CACHE_NAME = "vaxai-models-v1";
const MODEL_URLS = ["/api/v1/vision/stock/models/stock-counter/download"];

export async function registerModelCacheSW(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const cache = await caches.open(CACHE_NAME);

    for (const url of MODEL_URLS) {
      const existing = await cache.match(url);
      if (!existing) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch {
          // Model not available yet — will cache on first successful load
        }
      }
    }
  } catch {
    // Cache API not available
  }
}

export async function getCachedModelBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (response) return response.arrayBuffer();
  } catch {
    // Cache miss
  }
  return null;
}

export async function cacheModelResponse(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(data, {
      headers: { "Content-Type": "application/octet-stream" },
    });
    await cache.put(url, response);
  } catch {
    // Cache write failed
  }
}

export async function clearModelCache(): Promise<void> {
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    // Ignore
  }
}

export async function getModelCacheStatus(): Promise<{
  available: boolean;
  cachedModels: string[];
  totalBytes: number;
}> {
  const result = { available: false, cachedModels: [] as string[], totalBytes: 0 };

  if (typeof window === "undefined" || !("caches" in window)) return result;

  try {
    result.available = true;
    const cache = await caches.open(CACHE_NAME);

    for (const url of MODEL_URLS) {
      const response = await cache.match(url);
      if (response) {
        result.cachedModels.push(url);
        const blob = await response.clone().blob();
        result.totalBytes += blob.size;
      }
    }
  } catch {
    // Ignore
  }

  return result;
}
