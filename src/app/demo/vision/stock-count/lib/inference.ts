import type { Detection } from "./types";

const PRODUCT_CATALOG = [
  { label: "BCG Vaccine (20-dose)", category: "BCG", color: "#10b981" },
  { label: "OPV Vaccine (10-dose)", category: "OPV", color: "#3b82f6" },
  { label: "Pentavalent (1-dose)", category: "Pentavalent", color: "#f59e0b" },
  { label: "Measles Vaccine (10-dose)", category: "Measles", color: "#ef4444" },
  { label: "HPV Vaccine (1-dose)", category: "HPV", color: "#8b5cf6" },
  { label: "TT Vaccine (10-dose)", category: "TT", color: "#ec4899" },
  { label: "YF Vaccine (5-dose)", category: "Yellow Fever", color: "#f97316" },
  { label: "Diluent 5ml", category: "Diluent", color: "#6b7280" },
];

let frameCounter = 0;
let activeDetections: Detection[] = [];
const DETECTION_LIFETIME = 90;
const detectionTimestamps = new Map<string, number>();

export function runDemoInference(
  _videoFrame: HTMLVideoElement | HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number
): Detection[] {
  frameCounter++;

  if (frameCounter % 15 === 0 && Math.random() > 0.3) {
    const product = PRODUCT_CATALOG[Math.floor(Math.random() * PRODUCT_CATALOG.length)];
    const margin = 0.1;
    const maxW = 0.18;
    const maxH = 0.22;
    const x = margin + Math.random() * (1 - 2 * margin - maxW);
    const y = margin + Math.random() * (1 - 2 * margin - maxH);
    const w = 0.08 + Math.random() * (maxW - 0.08);
    const h = 0.1 + Math.random() * (maxH - 0.1);

    const det: Detection = {
      id: `det-${frameCounter}-${Math.random().toString(36).slice(2, 6)}`,
      label: product.label,
      confidence: 0.75 + Math.random() * 0.24,
      bbox: {
        x: x * canvasWidth,
        y: y * canvasHeight,
        width: w * canvasWidth,
        height: h * canvasHeight,
      },
      color: product.color,
      category: product.category,
    };

    const overlaps = activeDetections.some((d) => {
      const dx = Math.abs(d.bbox.x - det.bbox.x);
      const dy = Math.abs(d.bbox.y - det.bbox.y);
      return dx < det.bbox.width * 0.6 && dy < det.bbox.height * 0.6;
    });

    if (!overlaps) {
      activeDetections.push(det);
      detectionTimestamps.set(det.id, frameCounter);
    }
  }

  activeDetections = activeDetections.filter((d) => {
    const age = frameCounter - (detectionTimestamps.get(d.id) ?? 0);
    if (age > DETECTION_LIFETIME) {
      detectionTimestamps.delete(d.id);
      return false;
    }
    return true;
  });

  return [...activeDetections];
}

export function resetInference() {
  frameCounter = 0;
  activeDetections = [];
  detectionTimestamps.clear();
}

export type InferenceEngine = "demo" | "onnx" | "tfjs";

export async function loadModel(_engine: InferenceEngine): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 800));
  return true;
}
