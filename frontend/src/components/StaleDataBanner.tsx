import { AlertTriangle } from "lucide-react";
import { getCacheAge, isStale } from "@/lib/sync";

interface StaleDataBannerProps {
  cachedAt: number | null;
  thresholdMs?: number;
}

export default function StaleDataBanner({
  cachedAt,
  thresholdMs = 3_600_000,
}: StaleDataBannerProps) {
  if (!cachedAt) return null;
  const stale = isStale(cachedAt, thresholdMs);
  if (!stale) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span>
        Data last refreshed <strong>{getCacheAge(cachedAt)}</strong> — showing
        cached results. Connect to the internet for the latest data.
      </span>
    </div>
  );
}
