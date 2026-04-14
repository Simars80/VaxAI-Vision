"use client";

import type { ReconciliationRow } from "../lib/types";

interface ReconciliationViewProps {
  rows: ReconciliationRow[];
  sessionName: string;
  facility: string;
}

export default function ReconciliationView({ rows, sessionName, facility }: ReconciliationViewProps) {
  const matches = rows.filter((r) => r.status === "match").length;
  const discrepancies = rows.filter((r) => r.status !== "match").length;
  const totalSystem = rows.reduce((s, r) => s + r.systemCount, 0);
  const totalScanned = rows.reduce((s, r) => s + r.scannedCount, 0);

  const statusColor = (status: ReconciliationRow["status"]) => {
    switch (status) {
      case "match": return "#10b981";
      case "over": return "#f59e0b";
      case "under": return "#ef4444";
    }
  };

  const statusLabel = (status: ReconciliationRow["status"]) => {
    switch (status) {
      case "match": return "Match";
      case "over": return "Surplus";
      case "under": return "Shortage";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <SummaryCard label="Session" value={sessionName} sub={facility} />
        <SummaryCard label="System Total" value={totalSystem.toString()} color="#3b82f6" />
        <SummaryCard label="Scanned Total" value={totalScanned.toString()} color="#8b5cf6" />
        <SummaryCard
          label="Accuracy"
          value={rows.length > 0 ? `${((matches / rows.length) * 100).toFixed(0)}%` : "—"}
          color={discrepancies > 0 ? "#f59e0b" : "#10b981"}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "rgba(10,22,40,0.85)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "10px 16px",
            background: "rgba(255,255,255,0.04)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {["Product", "System", "Scanned", "Diff", "Status"].map((h) => (
            <span key={h} style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </span>
          ))}
        </div>

        {rows.map((row) => (
          <div
            key={row.category}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{row.productName}</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              {row.systemCount}
            </span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
              {row.scannedCount}
            </span>
            <span
              style={{
                color: statusColor(row.status),
                fontSize: 13,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.discrepancy > 0 ? `+${row.discrepancy}` : row.discrepancy}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: statusColor(row.status),
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(row.status) }} />
              {statusLabel(row.status)}
            </span>
          </div>
        ))}

        {/* Totals row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "12px 16px",
            background: "rgba(255,255,255,0.04)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Total</span>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {totalSystem}
          </span>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {totalScanned}
          </span>
          <span
            style={{
              color: totalScanned - totalSystem === 0 ? "#10b981" : "#f59e0b",
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalScanned - totalSystem > 0 ? `+${totalScanned - totalSystem}` : totalScanned - totalSystem}
          </span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {discrepancies} issue{discrepancies !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div
      style={{
        background: "rgba(10,22,40,0.85)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "12px 14px",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ color: color ?? "#fff", fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}
