"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getSessions,
  seedDemoSessions,
  createSession,
} from "./vision/stock-count/lib/session-store";
import type { StockSession } from "./vision/stock-count/lib/types";

/* --------------------------------------------------------------------------
   Local tokens — duplicated minimally here so the demo page can render
   without pulling in @chakra-ui/react (this route uses inline styles only,
   matching the existing pattern in the codebase).
-------------------------------------------------------------------------- */
const T = {
  bg: "#0e1116",
  panel: "#11161b",
  rule: "rgba(255,255,255,0.10)",
  ruleSoft: "rgba(255,255,255,0.06)",
  ink: "#ffffff",
  muted: "rgba(255,255,255,0.55)",
  brand: "#3A5BCC",
  brandBright: "#7a8fff",
  ok: "#3a8e54",
  watch: "#c89b2a",
  alert: "#c1392b",
  mono:
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  sans: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};

const DEMO_BASE = "https://app.vaxaivision.com";
const DEMO_URL = `${DEMO_BASE}?demo=true`;
const TOPBAR_HEIGHT = 48;

type TabId = "dashboard" | "forecasting" | "vision" | "ar-scanner";

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "forecasting", label: "Forecasting" },
  { id: "vision", label: "Vision AI" },
  { id: "ar-scanner", label: "AR Scanner" },
];

const TAB_IFRAME_URLS: Partial<Record<TabId, string>> = {
  dashboard: DEMO_URL,
  forecasting: `${DEMO_BASE}/forecast?demo=true&embed=true`,
  vision: `${DEMO_BASE}/vision?demo=true&embed=true`,
};

export default function DemoPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: T.bg }} />}>
      <DemoPageInner />
    </Suspense>
  );
}

/* ── Status badge for AR sessions ── */
function StatusBadge({ status }: { status: StockSession["status"] }) {
  const map: Record<StockSession["status"], { color: string; label: string }> = {
    active: { color: T.ok, label: "Active" },
    paused: { color: T.watch, label: "Paused" },
    submitted: { color: T.brand, label: "Submitted" },
    draft: { color: T.muted, label: "Draft" },
  };
  const s = map[status];
  return (
    <span
      style={{
        background: `${s.color}1f`,
        border: `1px solid ${s.color}55`,
        color: s.color,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        fontFamily: T.mono,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      ● {s.label}
    </span>
  );
}

/* ── Main page ── */
function DemoPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as TabId | null;
  const validTabs: TabId[] = ["dashboard", "forecasting", "vision", "ar-scanner"];
  const initialTab: TabId = tabParam && validTabs.includes(tabParam) ? tabParam : "dashboard";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [sessions, setSessions] = useState<StockSession[]>([]);
  const [arReady, setArReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === "ar-scanner" && !arReady) {
      seedDemoSessions();
      setSessions(getSessions());
      setArReady(true);
    }
  }, [activeTab, arReady]);

  const [iframeSrc, setIframeSrc] = useState<string>(
    TAB_IFRAME_URLS[initialTab] ?? DEMO_URL,
  );

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      if (TAB_IFRAME_URLS[tab]) {
        setIframeSrc(TAB_IFRAME_URLS[tab]!);
        setLoaded(false);
      }
      const url = tab === "dashboard" ? "/demo" : `/demo?tab=${tab}`;
      router.replace(url, { scroll: false });
    },
    [router],
  );

  const handleNewSession = () => {
    createSession("Demo Facility");
    setSessions(getSessions());
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        fontFamily: T.sans,
      }}
    >
      {/* ───────── Top chrome ───────── */}
      <div
        style={{
          height: TOPBAR_HEIGHT,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: T.bg,
          borderBottom: `1px solid ${T.rule}`,
          gap: 16,
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              background: T.brand,
              position: "relative",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            VaxAI Vision
          </span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.muted,
              letterSpacing: "0.08em",
              whiteSpace: "nowrap",
            }}
          >
            / demo
          </span>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            flex: 1,
            maxWidth: 540,
            height: 32,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${T.ruleSoft}`,
            display: "flex",
            alignItems: "center",
            padding: 2,
            gap: 2,
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  flex: 1,
                  height: "100%",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.01em",
                  fontFamily: T.mono,
                  transition: "all 0.15s ease",
                  background: isActive ? T.brand : "transparent",
                  color: isActive ? "#fff" : T.muted,
                  textTransform: "uppercase",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              border: `1px solid ${T.ok}66`,
              color: T.ok,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: T.mono,
              letterSpacing: "0.12em",
            }}
          >
            ● LIVE DEMO
          </span>
          <Link
            href="/"
            style={{
              height: 30,
              padding: "0 14px",
              borderRadius: 4,
              border: `1px solid ${T.rule}`,
              color: T.ink,
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s",
              fontFamily: T.mono,
              letterSpacing: "0.04em",
            }}
          >
            ✕ EXIT
          </Link>
        </div>
      </div>

      {/* ───────── Mobile fallback ───────── */}
      <div
        style={{
          display: "none",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: "40px 24px",
          textAlign: "center",
          gap: 16,
        }}
        className="demo-mobile-fallback"
      >
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.2em",
            color: T.brand,
            textTransform: "uppercase",
          }}
        >
          Desktop recommended
        </div>
        <p style={{ color: "#fff", fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: "-0.02em" }}>
          Best experienced on a wider screen.
        </p>
        <p style={{ color: T.muted, fontSize: 14, margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
          The VaxAI Vision dashboard is optimised for screens wider than 768 px. Continue on mobile or open in a new tab.
        </p>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 8,
            padding: "13px 24px",
            borderRadius: 6,
            background: T.brand,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(58,91,204,0.3)",
          }}
        >
          Open in new tab →
        </a>
        <Link href="/" style={{ color: T.muted, fontSize: 13 }}>
          ← Back to vaxaivision.com
        </Link>
      </div>

      {/* ───────── Content area ───────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} className="demo-iframe-wrapper">
        {/* iframe tabs */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: activeTab !== "ar-scanner" ? "block" : "none",
          }}
        >
          {!loaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                zIndex: 10,
                background: T.bg,
              }}
            >
              <div style={{ position: "relative", width: 48, height: 48 }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${T.ruleSoft}` }} />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: T.brand,
                    animation: "demoSpin 0.8s linear infinite",
                  }}
                />
              </div>
              <p style={{ color: T.muted, fontSize: 11, margin: 0, fontFamily: T.mono, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Loading live dashboard…
              </p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="VaxAI Vision Live Demo"
            onLoad={() => setLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>

        {/* AR scanner */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: activeTab === "ar-scanner" ? "block" : "none",
            overflowY: "auto",
            background: T.bg,
          }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginBottom: 32,
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.2em",
                    color: T.brand,
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  AR scanner · stock count
                </div>
                <h1
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    margin: 0,
                    color: "#fff",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  Stock count sessions.
                </h1>
                <p style={{ color: T.muted, fontSize: 14, marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>
                  AR-powered inventory counting with real-time detection and reconciliation against the system ledger.
                </p>
              </div>
              <button
                onClick={handleNewSession}
                style={{
                  height: 44,
                  padding: "0 22px",
                  borderRadius: 6,
                  background: T.brand,
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 4px 14px rgba(58,91,204,0.3)",
                }}
              >
                + New count
              </button>
            </div>

            {/* Stat row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 0,
                marginBottom: 32,
                borderTop: `1px solid ${T.rule}`,
                borderBottom: `1px solid ${T.rule}`,
              }}
            >
              <Link
                href="/demo/vision/stock-count/scan"
                style={{
                  textDecoration: "none",
                  padding: "24px 24px",
                  borderRight: `1px solid ${T.rule}`,
                  display: "block",
                  color: T.ink,
                }}
              >
                <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.16em", color: T.muted, textTransform: "uppercase", marginBottom: 8 }}>
                  Action
                </div>
                <div style={{ color: T.brandBright, fontWeight: 600, fontSize: 18, letterSpacing: "-0.015em" }}>
                  Quick scan →
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                  Start a new AR session
                </div>
              </Link>

              <div style={{ padding: "24px 24px", borderRight: `1px solid ${T.rule}` }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.16em", color: T.muted, textTransform: "uppercase", marginBottom: 8 }}>
                  Completed
                </div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 28, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {sessions.filter((s) => s.status === "submitted").length}
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                  Sessions submitted
                </div>
              </div>

              <div style={{ padding: "24px 24px" }}>
                <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.16em", color: T.muted, textTransform: "uppercase", marginBottom: 8 }}>
                  In progress
                </div>
                <div style={{ color: T.watch, fontWeight: 600, fontSize: 28, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {sessions.filter((s) => s.status === "active" || s.status === "paused").length}
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                  Active or paused
                </div>
              </div>
            </div>

            {/* Sessions */}
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.2em", color: T.muted, textTransform: "uppercase", marginBottom: 12 }}>
              Recent sessions
            </div>

            <div style={{ borderTop: `1px solid ${T.rule}` }}>
              {sessions.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 0",
                    color: T.muted,
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
                        borderBottom: `1px solid ${T.rule}`,
                        padding: "18px 4px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        cursor: "pointer",
                        transition: "background 0.15s",
                        color: T.ink,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                            {session.name}
                          </span>
                          <StatusBadge status={session.status} />
                        </div>
                        <div style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, letterSpacing: "0.04em" }}>
                          {session.facility} · {new Date(session.startedAt).toLocaleDateString()} ·{" "}
                          {session.tallies.reduce((s, t) => s + t.count, 0)} items counted
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 240 }}>
                        {session.tallies.slice(0, 4).map((t) => (
                          <span
                            key={t.category}
                            style={{
                              background: `${t.color}20`,
                              color: t.color,
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "3px 7px",
                              borderRadius: 3,
                              fontFamily: T.mono,
                              letterSpacing: "0.04em",
                            }}
                          >
                            {t.category}: {t.count}
                          </span>
                        ))}
                        {session.tallies.length > 4 && (
                          <span style={{ color: T.muted, fontSize: 10, fontFamily: T.mono }}>
                            +{session.tallies.length - 4}
                          </span>
                        )}
                      </div>
                      <span style={{ color: T.muted, fontSize: 18 }}>→</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes demoSpin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .demo-mobile-fallback { display: flex !important; }
          .demo-iframe-wrapper { display: none !important; }
        }
      `}</style>
    </div>
  );
}
