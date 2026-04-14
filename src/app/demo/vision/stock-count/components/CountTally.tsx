"use client";

import type { ProductTally } from "../lib/types";

interface CountTallyProps {
  tallies: ProductTally[];
  totalDetections: number;
}

export default function CountTally({ tallies, totalDetections }: CountTallyProps) {
  const sorted = [...tallies].sort((a, b) => b.count - a.count);
  const totalCount = tallies.reduce((s, t) => s + t.count, 0);

  return (
    <div
      style={{
        background: "rgba(10,22,40,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 16,
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Stock Tally</span>
        <span
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#10b981",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 99,
          }}
        >
          {totalCount} items
        </span>
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
          Scanning... Point camera at products
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((t) => (
            <div key={t.category} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: t.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, flex: 1 }}>
                {t.category}
              </span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {t.count}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Detections</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
          {totalDetections}
        </span>
      </div>
    </div>
  );
}
