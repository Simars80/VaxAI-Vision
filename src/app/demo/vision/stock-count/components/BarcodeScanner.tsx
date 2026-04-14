"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface BarcodeScannerProps {
  active: boolean;
  onScan: (code: string, format: string) => void;
}

export default function BarcodeScanner({ active, onScan }: BarcodeScannerProps) {
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "found">("idle");
  const cooldownRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateScan = useCallback(() => {
    if (cooldownRef.current) return;

    if (Math.random() > 0.85) {
      const prefixes = ["GTIN:", "LOT:", "SER:"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const code = `${prefix}${Math.random().toString().slice(2, 16)}`;
      const formats = ["QR_CODE", "DATA_MATRIX", "CODE_128"];
      const format = formats[Math.floor(Math.random() * formats.length)];

      setLastCode(code);
      setStatus("found");
      onScan(code, format);

      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
        setStatus("scanning");
      }, 3000);
    }
  }, [onScan]);

  useEffect(() => {
    if (active) {
      setStatus("scanning");
      intervalRef.current = setInterval(simulateScan, 500);
    } else {
      setStatus("idle");
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, simulateScan]);

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
          {status === "scanning" ? "Searching…" : status === "found" ? "Found!" : "Inactive"}
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
        <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
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
