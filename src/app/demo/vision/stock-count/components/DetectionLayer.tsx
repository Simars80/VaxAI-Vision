"use client";

import type { Detection } from "../lib/types";

interface DetectionLayerProps {
  detections: Detection[];
  containerWidth: number;
  containerHeight: number;
}

export default function DetectionLayer({ detections, containerWidth, containerHeight }: DetectionLayerProps) {
  if (detections.length === 0) return null;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {detections.map((det) => {
        const xPct = (det.bbox.x / containerWidth) * 100;
        const yPct = (det.bbox.y / containerHeight) * 100;
        const wPct = (det.bbox.width / containerWidth) * 100;
        const hPct = (det.bbox.height / containerHeight) * 100;

        return (
          <div
            key={det.id}
            style={{
              position: "absolute",
              left: `${xPct}%`,
              top: `${yPct}%`,
              width: `${wPct}%`,
              height: `${hPct}%`,
              border: `2px solid ${det.color}`,
              borderRadius: 4,
              background: `${det.color}10`,
              transition: "all 0.15s ease-out",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -20,
                left: 0,
                background: det.color,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 3,
                whiteSpace: "nowrap",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {det.category} {(det.confidence * 100).toFixed(0)}%
            </span>
            <div
              style={{
                position: "absolute",
                inset: 0,
                border: `1px solid ${det.color}40`,
                borderRadius: 4,
                animation: "pulse-ring 1.5s ease-out infinite",
              }}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.08); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
