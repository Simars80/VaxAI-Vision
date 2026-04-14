"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getSessions, seedDemoSessions, createSession } from "./lib/session-store";
import type { StockSession as SessionType } from "./lib/types";

function StatusBadge({ status }: { status: SessionType["status"] }) {
  const map: Record<SessionType["status"], { bg: string; border: string; color: string; label: string }> = {
    active: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", color: "#10b981", label: "Active" },
    paused: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", color: "#f59e0b", label: "Paused" },
    submitted: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.3)", color: "#6366f1", label: "Submitted" },
    draft: { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.3)", color: "#6b7280", label: "Draft" },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
      {s.label}
    </span>
  );
}

export default function StockCountPage() {
  const [sessions, setSessions] = useState<ReturnType<typeof getSessions>>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDemoSessions();
    setSessions(getSessions());
    setReady(true);
  }, []);

  const handleNewSession = () => {
    createSession("Demo Facility");
    setSessions(getSessions());
  };

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
          <Link href="/demo" style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
            ← Demo
          </Link>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
              }}
            >
              📦
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>AR Stock Counter</span>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 7,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Count
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Stock Count Sessions</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "6px 0 0" }}>
            AR-powered inventory counting with real-time detection and reconciliation
          </p>
        </div>

        {/* Quick action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
          <Link href="/demo/vision/stock-count/scan" style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(139,92,246,0.15))",
                border: "1px solid rgba(37,99,235,0.3)",
                borderRadius: 12,
                padding: 20,
                cursor: "pointer",
                transition: "border-color 0.2s",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Quick Scan</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
                Start a new AR scanning session
              </div>
            </div>
          </Link>
          <div
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
              {sessions.filter((s) => s.status === "submitted").length} Completed
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
              Sessions submitted this period
            </div>
          </div>
          <div
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
              {sessions.filter((s) => s.status === "active" || s.status === "paused").length} In Progress
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
              Active or paused sessions
            </div>
          </div>
        </div>

        {/* Session list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 0",
                color: "rgba(255,255,255,0.4)",
                fontSize: 14,
              }}
            >
              No sessions yet. Start a new count to begin.
            </div>
          ) : (
            sessions.map((session) => (
              <Link
                key={session.id}
                href={
                  session.status === "submitted"
                    ? `/demo/vision/stock-count/review?session=${session.id}`
                    : `/demo/vision/stock-count/scan?session=${session.id}`
                }
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    cursor: "pointer",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{session.name}</span>
                      <StatusBadge status={session.status} />
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                      {session.facility} · {new Date(session.startedAt).toLocaleDateString()} · {session.tallies.reduce((s, t) => s + t.count, 0)} items counted
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 200 }}>
                    {session.tallies.slice(0, 4).map((t) => (
                      <span
                        key={t.category}
                        style={{
                          background: `${t.color}20`,
                          color: t.color,
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {t.category}: {t.count}
                      </span>
                    ))}
                    {session.tallies.length > 4 && (
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                        +{session.tallies.length - 4}
                      </span>
                    )}
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 16 }}>→</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
