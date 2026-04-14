const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ApiSession {
  id: string;
  facility_id: string;
  status: string;
  product_count: number;
  frame_count: number;
  created_at: string;
  updated_at: string;
}

interface ApiFrameDetection {
  product_code: string;
  product_name: string;
  quantity: number;
  confidence: number;
  bounding_box: { x1: number; y1: number; x2: number; y2: number };
}

interface ApiRunningCount {
  product_code: string;
  product_name: string;
  total_quantity: number;
}

interface FrameSubmitResponse {
  session_id: string;
  frame_index: number;
  detections_added: number;
  running_counts: ApiRunningCount[];
}

interface ReconciliationItem {
  product_code: string;
  product_name: string;
  system_quantity: number;
  scanned_quantity: number;
  discrepancy: number;
  status: "match" | "over" | "under";
}

interface ReconciliationResponse {
  session_id: string;
  facility_id: string;
  total_products_scanned: number;
  total_discrepancies: number;
  items: ReconciliationItem[];
  reconciled_at: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("vaxai_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${API_BASE}/api/v1/vision/stock${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

export async function createApiSession(facilityId: string): Promise<ApiSession> {
  const data = await apiFetch<{ session: ApiSession }>("/session", {
    method: "POST",
    body: JSON.stringify({ facility_id: facilityId }),
  });
  return data.session;
}

export async function getApiSession(sessionId: string): Promise<ApiSession & { running_counts: ApiRunningCount[] }> {
  return apiFetch(`/session/${sessionId}`);
}

export async function submitFrameDetections(
  sessionId: string,
  frameIndex: number,
  detections: ApiFrameDetection[],
): Promise<FrameSubmitResponse> {
  return apiFetch(`/session/${sessionId}/frame`, {
    method: "POST",
    body: JSON.stringify({ frame_index: frameIndex, detections }),
  });
}

export async function submitFrameImage(
  sessionId: string,
  frameIndex: number,
  imageBlob: Blob,
  confidence = 0.25,
): Promise<FrameSubmitResponse & { detections: unknown[]; inference_ms: number }> {
  const form = new FormData();
  form.append("image", imageBlob, "frame.jpg");
  form.append("frame_index", String(frameIndex));
  form.append("confidence", String(confidence));

  const token =
    typeof window !== "undefined" ? localStorage.getItem("vaxai_token") : null;

  const res = await fetch(
    `${API_BASE}/api/v1/vision/stock/session/${sessionId}/detect-frame`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    },
  );

  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function reconcileSession(sessionId: string): Promise<ReconciliationResponse> {
  return apiFetch(`/session/${sessionId}/reconcile`, { method: "POST" });
}

export async function getModelStatus(): Promise<{
  name: string;
  version: string;
  loaded: boolean;
  backend: string;
  classes: string[];
}> {
  return apiFetch("/models/status");
}

export function isApiAvailable(): boolean {
  return Boolean(API_BASE);
}

export type {
  ApiSession,
  ApiFrameDetection,
  ApiRunningCount,
  FrameSubmitResponse,
  ReconciliationItem,
  ReconciliationResponse,
};
