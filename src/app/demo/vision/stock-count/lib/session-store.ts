import type { StockSession, Detection, ProductTally, ReconciliationRow } from "./types";
import {
  createApiSession,
  getApiSession,
  submitFrameDetections,
  reconcileSession as apiReconcile,
  isApiAvailable,
  type ApiFrameDetection,
} from "./api-client";

let sessions: StockSession[] = [];
let pendingFrames: { sessionId: string; detections: ApiFrameDetection[]; frameIndex: number }[] = [];

const SYSTEM_INVENTORY: Record<string, number> = {
  BCG: 48,
  OPV: 120,
  Pentavalent: 85,
  Measles: 60,
  HPV: 30,
  TT: 45,
  "Yellow Fever": 25,
  Diluent: 100,
};

export function createSession(facility: string): StockSession {
  const session: StockSession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Stock Count — ${new Date().toLocaleDateString()}`,
    status: "active",
    startedAt: new Date().toISOString(),
    detections: [],
    tallies: [],
    facility,
  };
  sessions = [session, ...sessions];

  if (isApiAvailable()) {
    createApiSession(facility)
      .then((apiSession) => {
        const oldId = session.id;
        session.id = apiSession.id;
        pendingFrames = pendingFrames.map((f) =>
          f.sessionId === oldId ? { ...f, sessionId: apiSession.id } : f,
        );
      })
      .catch(() => {});
  }

  return session;
}

export function getSession(id: string): StockSession | undefined {
  return sessions.find((s) => s.id === id);
}

export function getSessions(): StockSession[] {
  return [...sessions];
}

let frameIndex = 0;

export function addDetections(sessionId: string, detections: Detection[]): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const newDets: Detection[] = [];
  for (const det of detections) {
    const exists = session.detections.some((d) => d.id === det.id);
    if (!exists) {
      session.detections.push(det);
      newDets.push(det);
      const tally = session.tallies.find((t) => t.category === det.category);
      if (tally) {
        tally.count++;
      } else {
        session.tallies.push({
          category: det.category,
          label: det.label,
          count: 1,
          color: det.color,
        });
      }
    }
  }

  if (isApiAvailable() && newDets.length > 0) {
    frameIndex++;
    const apiDets: ApiFrameDetection[] = newDets.map((d) => ({
      product_code: d.category,
      product_name: d.label,
      quantity: 1,
      confidence: d.confidence,
      bounding_box: {
        x1: d.bbox.x,
        y1: d.bbox.y,
        x2: d.bbox.x + d.bbox.width,
        y2: d.bbox.y + d.bbox.height,
      },
    }));

    submitFrameDetections(sessionId, frameIndex, apiDets).catch(() => {
      pendingFrames.push({ sessionId, detections: apiDets, frameIndex });
    });
  }
}

export function pauseSession(id: string): void {
  const s = sessions.find((s) => s.id === id);
  if (s) s.status = "paused";
}

export function resumeSession(id: string): void {
  const s = sessions.find((s) => s.id === id);
  if (s && s.status === "paused") s.status = "active";
}

export function submitSession(id: string): void {
  const s = sessions.find((s) => s.id === id);
  if (s) {
    s.status = "submitted";
    s.submittedAt = new Date().toISOString();
  }
}

export function getReconciliation(sessionId: string): ReconciliationRow[] {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return [];

  const rows: ReconciliationRow[] = [];
  const scannedMap = new Map<string, number>();
  for (const t of session.tallies) {
    scannedMap.set(t.category, t.count);
  }

  for (const [category, systemCount] of Object.entries(SYSTEM_INVENTORY)) {
    const scannedCount = scannedMap.get(category) ?? 0;
    const discrepancy = scannedCount - systemCount;
    rows.push({
      productName: category,
      category,
      systemCount,
      scannedCount,
      discrepancy,
      status: discrepancy === 0 ? "match" : discrepancy > 0 ? "over" : "under",
    });
    scannedMap.delete(category);
  }

  for (const [category, count] of Array.from(scannedMap)) {
    rows.push({
      productName: category,
      category,
      systemCount: 0,
      scannedCount: count,
      discrepancy: count,
      status: "over",
    });
  }

  return rows;
}

export async function getReconciliationFromApi(
  sessionId: string,
): Promise<ReconciliationRow[] | null> {
  if (!isApiAvailable()) return null;

  try {
    const resp = await apiReconcile(sessionId);
    return resp.items.map((item) => ({
      productName: item.product_name,
      category: item.product_code,
      systemCount: item.system_quantity,
      scannedCount: item.scanned_quantity,
      discrepancy: item.discrepancy,
      status: item.status,
    }));
  } catch {
    return null;
  }
}

export async function syncPendingFrames(): Promise<number> {
  if (pendingFrames.length === 0) return 0;

  let synced = 0;
  const remaining: typeof pendingFrames = [];

  for (const frame of pendingFrames) {
    try {
      await submitFrameDetections(frame.sessionId, frame.frameIndex, frame.detections);
      synced++;
    } catch {
      remaining.push(frame);
    }
  }

  pendingFrames = remaining;
  return synced;
}

export function getPendingFrameCount(): number {
  return pendingFrames.length;
}

export async function refreshSessionFromApi(sessionId: string): Promise<ProductTally[] | null> {
  if (!isApiAvailable()) return null;
  try {
    const apiSession = await getApiSession(sessionId);
    if (apiSession.running_counts) {
      return apiSession.running_counts.map((rc) => ({
        category: rc.product_code,
        label: rc.product_name,
        count: rc.total_quantity,
        color: "#3b82f6",
      }));
    }
  } catch {
    // Offline
  }
  return null;
}

export function seedDemoSessions(): void {
  if (sessions.length > 0) return;
  const demoSession: StockSession = {
    id: "demo-session-1",
    name: "Weekly Count — Zone A",
    status: "submitted",
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    submittedAt: new Date(Date.now() - 82800000).toISOString(),
    facility: "Kano Central Vaccine Store",
    detections: [],
    tallies: [
      { category: "BCG", label: "BCG Vaccine (20-dose)", count: 45, color: "#10b981" },
      { category: "OPV", label: "OPV Vaccine (10-dose)", count: 118, color: "#3b82f6" },
      { category: "Pentavalent", label: "Pentavalent (1-dose)", count: 85, color: "#f59e0b" },
      { category: "Measles", label: "Measles Vaccine (10-dose)", count: 57, color: "#ef4444" },
    ],
  };
  const demoSession2: StockSession = {
    id: "demo-session-2",
    name: "Monthly Audit — Zone B",
    status: "submitted",
    startedAt: new Date(Date.now() - 604800000).toISOString(),
    submittedAt: new Date(Date.now() - 601200000).toISOString(),
    facility: "Lagos State Cold Store",
    detections: [],
    tallies: [
      { category: "HPV", label: "HPV Vaccine (1-dose)", count: 28, color: "#8b5cf6" },
      { category: "TT", label: "TT Vaccine (10-dose)", count: 44, color: "#ec4899" },
      { category: "Yellow Fever", label: "YF Vaccine (5-dose)", count: 25, color: "#f97316" },
    ],
  };
  sessions = [demoSession, demoSession2];
}
