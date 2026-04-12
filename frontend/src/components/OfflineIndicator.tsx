import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { type SyncStatus, onSyncStatusChange, pendingCount } from "@/lib/sync";

export default function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>(
    navigator.onLine ? "online" : "offline",
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const unsub = onSyncStatusChange((s) => {
      setStatus(s);
      pendingCount().then(setPending);
    });
    pendingCount().then(setPending);
    return unsub;
  }, []);

  if (status === "online" && pending === 0) return null;

  const config = {
    offline: {
      bg: "bg-red-600",
      icon: <WifiOff className="h-3.5 w-3.5" />,
      text: "Offline — viewing cached data",
    },
    syncing: {
      bg: "bg-blue-600",
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      text: `Syncing ${pending} pending change${pending !== 1 ? "s" : ""}…`,
    },
    online: {
      bg: "bg-emerald-600",
      icon: <Wifi className="h-3.5 w-3.5" />,
      text: `Back online — ${pending} change${pending !== 1 ? "s" : ""} queued`,
    },
  }[status];

  return (
    <div
      className={`${config.bg} text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2 flex-shrink-0`}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
