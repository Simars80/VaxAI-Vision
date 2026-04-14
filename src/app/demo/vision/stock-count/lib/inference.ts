import type { Detection } from "./types";

export type InferenceEngine = "demo" | "onnx" | "tfjs";

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

const YOLO_CLASSES: Record<number, { name: string; category: string; color: string }> = {
  0: { name: "Vaccine Vial", category: "BCG", color: "#10b981" },
  1: { name: "Syringe", category: "Diluent", color: "#6b7280" },
  2: { name: "Cold Box", category: "OPV", color: "#3b82f6" },
  3: { name: "Diluent", category: "Diluent", color: "#6b7280" },
  4: { name: "Ancillary Product", category: "TT", color: "#ec4899" },
};

const MODEL_INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;
const NMS_IOU_THRESHOLD = 0.45;

let frameCounter = 0;
let activeDetections: Detection[] = [];
const DETECTION_LIFETIME = 90;
const detectionTimestamps = new Map<string, number>();

let currentEngine: InferenceEngine = "demo";
let onnxSession: unknown = null;
let modelLoaded = false;

function runDemoDetection(canvasWidth: number, canvasHeight: number): Detection[] {
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

function preprocessFrame(
  video: HTMLVideoElement | HTMLCanvasElement,
  size: number,
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData;

  const float32 = new Float32Array(3 * size * size);
  const pixelCount = size * size;
  for (let i = 0; i < pixelCount; i++) {
    float32[i] = data[i * 4] / 255.0;
    float32[pixelCount + i] = data[i * 4 + 1] / 255.0;
    float32[2 * pixelCount + i] = data[i * 4 + 2] / 255.0;
  }
  return float32;
}

function nonMaxSuppression(
  boxes: { x: number; y: number; w: number; h: number; score: number; classId: number }[],
  iouThreshold: number,
): typeof boxes {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const selected: typeof boxes = [];

  for (const box of sorted) {
    let suppressed = false;
    for (const sel of selected) {
      const x1 = Math.max(box.x, sel.x);
      const y1 = Math.max(box.y, sel.y);
      const x2 = Math.min(box.x + box.w, sel.x + sel.w);
      const y2 = Math.min(box.y + box.h, sel.y + sel.h);
      const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = box.w * box.h + sel.w * sel.h - intersection;
      if (union > 0 && intersection / union > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) selected.push(box);
  }
  return selected;
}

async function runOnnxInference(
  videoFrame: HTMLVideoElement | HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number,
): Promise<Detection[]> {
  if (!onnxSession) return [];

  const inputData = preprocessFrame(videoFrame, MODEL_INPUT_SIZE);

  const ort = await import("onnxruntime-web");
  const tensor = new ort.Tensor("float32", inputData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  const session = onnxSession as { run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>>; outputNames: string[] };
  const results = await session.run({ images: tensor });

  const output = results[session.outputNames[0]];
  if (!output) return [];

  const data = output.data as Float32Array;
  const numDetections = output.dims[2];
  const numClasses = Object.keys(YOLO_CLASSES).length;
  const rawBoxes: { x: number; y: number; w: number; h: number; score: number; classId: number }[] = [];

  for (let i = 0; i < numDetections; i++) {
    const cx = data[0 * numDetections + i];
    const cy = data[1 * numDetections + i];
    const w = data[2 * numDetections + i];
    const h = data[3 * numDetections + i];

    let maxScore = 0;
    let maxClassId = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        maxClassId = c;
      }
    }

    if (maxScore >= CONFIDENCE_THRESHOLD) {
      const scaleX = canvasWidth / MODEL_INPUT_SIZE;
      const scaleY = canvasHeight / MODEL_INPUT_SIZE;
      rawBoxes.push({
        x: (cx - w / 2) * scaleX,
        y: (cy - h / 2) * scaleY,
        w: w * scaleX,
        h: h * scaleY,
        score: maxScore,
        classId: maxClassId,
      });
    }
  }

  const nmsBoxes = nonMaxSuppression(rawBoxes, NMS_IOU_THRESHOLD);

  return nmsBoxes.map((box, idx) => {
    const cls = YOLO_CLASSES[box.classId] ?? { name: "Unknown", category: "Unknown", color: "#6b7280" };
    return {
      id: `onnx-${Date.now()}-${idx}`,
      label: cls.name,
      confidence: box.score,
      bbox: { x: box.x, y: box.y, width: box.w, height: box.h },
      color: cls.color,
      category: cls.category,
    };
  });
}

export function runDemoInference(
  videoFrame: HTMLVideoElement | HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number,
): Detection[] {
  if (currentEngine === "onnx" && modelLoaded) {
    runOnnxInference(videoFrame, canvasWidth, canvasHeight).then((dets) => {
      activeDetections = dets;
    });
    return [...activeDetections];
  }

  return runDemoDetection(canvasWidth, canvasHeight);
}

export function resetInference() {
  frameCounter = 0;
  activeDetections = [];
  detectionTimestamps.clear();
}

export function getActiveEngine(): InferenceEngine {
  return currentEngine;
}

export function isModelLoaded(): boolean {
  return modelLoaded;
}

export async function loadModel(engine: InferenceEngine): Promise<boolean> {
  currentEngine = engine;

  if (engine === "demo") {
    await new Promise((r) => setTimeout(r, 400));
    modelLoaded = true;
    return true;
  }

  if (engine === "onnx") {
    try {
      const ort = await import("onnxruntime-web");

      ort.env.wasm.wasmPaths = "/onnx/";

      const modelUrl = "/api/v1/vision/stock/models/stock-counter/download";
      const cachedModel = await loadCachedModel(modelUrl);

      if (cachedModel) {
        onnxSession = await ort.InferenceSession.create(cachedModel, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
      } else {
        onnxSession = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
      }

      modelLoaded = true;
      currentEngine = "onnx";
      return true;
    } catch {
      console.warn("ONNX model load failed, falling back to demo mode");
      currentEngine = "demo";
      modelLoaded = true;
      return true;
    }
  }

  currentEngine = "demo";
  modelLoaded = true;
  return true;
}

async function loadCachedModel(url: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open("vaxai-models-v1");
    const response = await cache.match(url);
    if (response) return response.arrayBuffer();
  } catch {
    // Cache API not available
  }
  return null;
}

export async function cacheModel(url: string): Promise<void> {
  try {
    const cache = await caches.open("vaxai-models-v1");
    const existing = await cache.match(url);
    if (!existing) {
      await cache.add(url);
    }
  } catch {
    // Cache API not available
  }
}
