"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReconciliationView from "../components/ReconciliationView";
import { getSession, getReconciliation, seedDemoSessions } from "../lib/session-store";
import type { StockSession, ReconciliationRow } from "../lib/types";

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a1628" }} />}>
      <ReviewPageInner />
    </Suspense>
  );
}

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<StockSession | null>(null);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDemoSessions();
    const sid = searchParams.get("session");
    if (sid) {
      const s = getSession(sid);
      if (s) {
        setSession(s);
        setRows(getReconciliation(sid));
      }
    }
    setReady(true);
  }, [searchParams]);

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", color: "#fff" }}>
      {/* Top bar */}
      <div
        style={{
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          background: "#0d1f3c",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/demo/vision/stock-count" style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
            ← Sessions
          </Link>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Reconciliation</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 7,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Export
          </button>
          <Link
            href="/demo/vision/stock-count/scan"
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 7,
              background: "#2563eb",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            New Scan
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        {!session ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>No Session Selected</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
              Select a completed session from the session list to view reconciliation.
            </p>
            <Link
              href="/demo/vision/stock-count"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 24px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              View Sessions
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Reconciliation Report</h1>
                <span
                  style={{
                    background: "rgba(99,102,241,0.15)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#6366f1",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                  }}
                >
                  {session.status.toUpperCase()}
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
                System inventory vs. AR-scanned counts — {session.facility}
                {session.submittedAt && ` · Submitted ${new Date(session.submittedAt).toLocaleString()}`}
              </p>
            </div>

            <ReconciliationView rows={rows} sessionName={session.name} facility={session.facility} />

            {/* Tally breakdown */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Scan Breakdown</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {session.tallies.map((t) => (
                  <div
                    key={t.category}
                    style={{
                      background: `${t.color}15`,
                      border: `1px solid ${t.color}30`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      minWidth: 120,
                    }}
                  >
                    <div style={{ color: t.color, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                      {t.category}
                    </div>
                    <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {t.count}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
