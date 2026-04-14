"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Detection } from "../lib/types";

interface AROverlayProps {
  detections: Detection[];
  width: number;
  height: number;
}

export default function AROverlay({ detections, width, height }: AROverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    for (const det of detections) {
      const { x, y, width: bw, height: bh } = det.bbox;

      ctx.strokeStyle = det.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, bw, bh);
      ctx.setLineDash([]);

      const cornerLen = Math.min(bw, bh) * 0.2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + bw - cornerLen, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + cornerLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + bw, y + bh - cornerLen); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw - cornerLen, y + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + cornerLen, y + bh); ctx.lineTo(x, y + bh); ctx.lineTo(x, y + bh - cornerLen);
      ctx.stroke();

      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      const textMetrics = ctx.measureText(label);
      const textH = 18;
      const textW = textMetrics.width + 10;
      const labelY = y > textH + 4 ? y - textH - 2 : y + bh + 2;

      ctx.fillStyle = det.color;
      ctx.beginPath();
      ctx.roundRect(x, labelY, textW, textH, 3);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(label, x + 5, labelY + 13);
    }
  }, [detections, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
