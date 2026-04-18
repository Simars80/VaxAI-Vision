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

const DEMO_BASE = "https://app.vaxaivision.com";
const DEMO_URL = `${DEMO_BASE}?demo=true`;
const TOPBAR_HEIGHT = 44;

type TabId = "dashboard" | "forecasting" | "vision" | "ar-scanner";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "forecasting", label: "Forecasting", icon: "📈" },
  { id: "vision", label: "Vision AI", icon: "🤖" },
  { id: "ar-scanner", label: "AR Scanner", icon: "📷" },
];

/* Map tabs to iframe URLs — dashboard tabs load inside the iframe, AR Scanner is inline */
const TAB_IFRAME_URLS: Partial<Record<TabId, string>> = {
  dashboard: DEMO_URL,
  forecasting: `${DEMO_BASE}/forecast?demo=true&embed=true`,
  vision: `${DEMO_BASE}/vision?demo=true&embed=true`,
};

export default function DemoPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: "#0a1628" }} />}>
      <DemoPageInner />
    </Suspense>
  );
}

/* ── Status badge (reused from stock-count page) ── */
function StatusBadge({ status }: { status: StockSession["status"] }) {
  const map: Record<
    StockSession["status"],
    { bg: string; border: string; color: string; label: string }
  > = {
    active: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", color: "#10b981", label: "Active" },
    paused: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", color: "#f59e0b", label: "Paused" },
    submitted: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.3)", color: "#6366f1", label: "Submitted" },
    draft: { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.3)", color: "#6b7280", label: "Draft" },
  };
  const s = map[status];
  return (
    <span
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 99,
      }}
    >
      {s.label}
    </span>
  );
}

/* ── Main page ── */
function DemoPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  /* Tab state — initialise from ?tab= query param */
  const tabParam = searchParams.get("tab") as TabId | null;
  const validTabs: TabId[] = ["dashboard", "forecasting", "vision", "ar-scanner"];
  const initialTab: TabId = tabParam && validTabs.includes(tabParam) ? tabParam : "dashboard";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  /* Dashboard iframe state */
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* AR Stock Counter state */
  const [sessions, setSessions] = useState<StockSession[]>([]);
  const [arReady, setArReady] = useState(false);

  /* Fallback: if iframe onLoad doesn't fire within 5s, show it anyway */
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  /* Seed demo sessions when AR tab is first shown */
  useEffect(() => {
    if (activeTab === "ar-scanner" && !arReady) {
      seedDemoSessions();
      setSessions(getSessions());
      setArReady(true);
    }
  }, [activeTab, arReady]);

  /* Track iframe URL per tab so switching back doesn't reload */
  const [iframeSrc, setIframeSrc] = useState<string>(
    TAB_IFRAME_URLS[initialTab] ?? DEMO_URL,
  );

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      /* Update iframe src if this is an iframe-based tab */
      if (TAB_IFRAME_URLS[tab]) {
        setIframeSrc(TAB_IFRAME_URLS[tab]!);
        setLoaded(false); // show loader while new route loads
      }
      /* Update URL without a full navigation so bookmarkability is preserved */
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628" }}>
      {/* ───────── Browser chrome top bar ───────── */}
      <div
        style={{
          height: TOPBAR_HEIGHT,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "linear-gradient(180deg, #1a2236 0%, #151d2e 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#EF4444", opacity: 0.8 }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#F59E0B", opacity: 0.8 }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22C55E", opacity: 0.8 }} />
        </div>

        {/* Tab switcher — sits where the URL bar used to be */}
        <div
          style={{
            flex: 1,
            maxWidth: 520,
            margin: "0 16px",
            height: 30,
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
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
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: "0.01em",
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  transition: "all 0.15s ease",
                  background: isActive
                    ? "rgba(37,99,235,0.2)"
                    : "transparent",
                  color: isActive
                    ? "#60A5FA"
                    : "rgba(255,255,255,0.35)",
                  ...(isActive
                    ? { boxShadow: "0 0 0 1px rgba(37,99,235,0.3)" }
                    : {}),
                }}
              >
                <span style={{ fontSize: 11 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right side: LIVE DEMO badge + Exit Demo link */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 99,
              background: "rgba(16,185,129,0.15)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#10b981",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            LIVE DEMO
          </span>
          <Link
            href="/"
            style={{
              height: 28,
              padding: "0 12px",
              borderRadius: 6,
              background: "rgba(37,99,235,0.15)",
              border: "1px solid rgba(37,99,235,0.25)",
              color: "#60A5FA",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              gap: 5,
              transition: "all 0.2s",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit Demo
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
        <div style={{ fontSize: 40 }}>🖥️</div>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 20, margin: 0 }}>
          Best experienced on desktop
        </p>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, margin: 0, maxWidth: 320 }}>
          The VaxAI Vision dashboard is optimised for screens wider than 768 px.
        </p>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 8,
            padding: "12px 28px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          Open in New Tab
        </a>
        <Link href="/" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          ← Back to vaxaivision.com
        </Link>
      </div>

      {/* ───────── Content area ───────── */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
        className="demo-iframe-wrapper"
      >
        {/* === IFRAME TABS (Dashboard / Forecasting / Vision) === */}
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
                background: "#0d1f3c",
              }}
            >
              <div style={{ position: "relative", width: 48, height: 48 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid rgba(37,99,235,0.15)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: "#2563eb",
                    animation: "demoSpin 0.8s linear infinite",
                  }}
                />
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 13,
                  fontWeight: 500,
                  margin: 0,
                  letterSpacing: "0.02em",
                }}
              >
                Loading live dashboard...
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

        {/* === AR STOCK COUNTER TAB === */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: activeTab === "ar-scanner" ? "block" : "none",
            overflowY: "auto",
            background: "#0a1628",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    📦
                  </div>
                  <h1
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      margin: 0,
                      color: "#fff",
                    }}
                  >
                    Stock Count Sessions
                  </h1>
                </div>
                <p
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 13,
                    margin: 0,
                  }}
                >
                  AR-powered inventory counting with real-time detection and
                  reconciliation
                </p>
              </div>
              <button
                onClick={handleNewSession}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "background 0.15s",
                }}
              >
                + New Count
              </button>
            </div>

            {/* Quick action cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <Link
                href="/demo/vision/stock-count/scan"
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(139,92,246,0.15))",
                    border: "1px solid rgba(37,99,235,0.3)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                    Quick Scan
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
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
                  {sessions.filter((s) => s.status === "submitted").length}{" "}
                  Completed
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
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
                  {sessions.filter(
                    (s) => s.status === "active" || s.status === "paused",
                  ).length}{" "}
                  In Progress
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Active or paused sessions
                </div>
              </div>
            </div>

            {/* Session list */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            {session.name}
                          </span>
                          <StatusBadge status={session.status} />
                        </div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 12,
                          }}
                        >
                          {session.facility} ·{" "}
                          {new Date(session.startedAt).toLocaleDateString()} ·{" "}
                          {session.tallies.reduce((s, t) => s + t.count, 0)}{" "}
                          items counted
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          maxWidth: 200,
                        }}
                      >
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
                          <span
                            style={{
                              color: "rgba(255,255,255,0.3)",
                              fontSize: 10,
                            }}
                          >
                            +{session.tallies.length - 4}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          fontSize: 16,
                        }}
                      >
                        →
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes demoSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 767px) {
          .demo-mobile-fallback { display: flex !important; }
          .demo-iframe-wrapper { display: none !important; }
        }
      `}</style>
    </div>
  );
}
