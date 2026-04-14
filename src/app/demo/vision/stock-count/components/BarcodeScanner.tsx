"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface BarcodeScannerProps {
  active: boolean;
  onScan: (code: string, format: string) => void;
  videoElement?: HTMLVideoElement | null;
}

export default function BarcodeScanner({ active, onScan, videoElement }: BarcodeScannerProps) {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "found">("idle");
  const [scanCount, setScanCount] = useState(0);
  const [useZXing, setUseZXing] = useState(false);
  const cooldownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDetection = useCallback(
    (code: string, format: string) => {
      if (cooldownRef.current) return;

      setLastCode(code);
      setStatus("found");
      setScanCount((c) => c + 1);
      onScan(code, format);

      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
        if (active) setStatus("scanning");
      }, 3000);
    },
    [onScan, active],
  );

  const scanFrameWithZXing = useCallback(async () => {
    if (!videoElement || !active || cooldownRef.current) return;
    if (videoElement.readyState < 2) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = reader.decodeFromCanvas(canvas);
      if (result) {
        const format = String(result.getBarcodeFormat());
        handleDetection(result.getText(), format);
      }
    } catch {
      // No barcode in frame — normal
    }
  }, [videoElement, active, handleDetection]);

  const runDemoFallback = useCallback(() => {
    if (cooldownRef.current) return;
    if (Math.random() > 0.85) {
      const prefixes = ["GTIN:", "LOT:", "SER:"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const code = `${prefix}${Math.random().toString().slice(2, 16)}`;
      const formats = ["QR_CODE", "DATA_MATRIX", "CODE_128"];
      const format = formats[Math.floor(Math.random() * formats.length)];
      handleDetection(code, format);
    }
  }, [handleDetection]);

  useEffect(() => {
    if (videoElement) {
      import("@zxing/browser")
        .then(() => setUseZXing(true))
        .catch(() => setUseZXing(false));
    } else {
      setUseZXing(false);
    }
  }, [videoElement]);

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    setStatus("scanning");

    if (useZXing && videoElement) {
      intervalRef.current = setInterval(scanFrameWithZXing, 400);
    } else {
      intervalRef.current = setInterval(runDemoFallback, 500);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [active, useZXing, videoElement, scanFrameWithZXing, runDemoFallback]);

  return (
    <div
      style={{
        background: "rgba(10,22,40,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: status === "found" ? "#10b981" : status === "scanning" ? "#f59e0b" : "#6b7280",
            boxShadow: status === "scanning" ? "0 0 6px #f59e0b" : "none",
          }}
        />
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>Barcode Scanner</span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginLeft: "auto" }}>
          {status === "scanning"
            ? useZXing
              ? "ZXing active…"
              : "Demo mode…"
            : status === "found"
              ? `Found! (${scanCount})`
              : "Inactive"}
        </span>
      </div>

      {lastCode && (
        <div
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 6,
            padding: "6px 8px",
            fontFamily: "monospace",
            fontSize: 11,
            color: "#10b981",
            wordBreak: "break-all",
          }}
        >
          {lastCode}
        </div>
      )}

      {active && !lastCode && (
        <div
          style={{
            position: "relative",
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: "30%",
              background: "linear-gradient(90deg, transparent, #f59e0b, transparent)",
              borderRadius: 2,
              animation: "barcode-sweep 1.5s ease-in-out infinite",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes barcode-sweep {
          0% { left: -30%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
