import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => /\/api\/v1\/(inventory|cold-chain|coverage)/.test(url.pathname),
  new NetworkFirst({
    cacheName: "api-data-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  ({ url }) => url.hostname.includes("tile.openstreetmap.org"),
  new CacheFirst({
    cacheName: "map-tile-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 604800 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);
