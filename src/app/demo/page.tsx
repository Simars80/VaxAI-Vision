"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

const DEMO_URL = "https://app.vaxaivision.com?demo=true";
const TOPBAR_HEIGHT = 44;

export default function DemoPage() {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fallback: if onLoad doesn't fire within 5s, show iframe anyway
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628" }}>
      {/* Browser chrome top bar */}
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

        {/* URL bar */}
        <div
          style={{
            flex: 1,
            maxWidth: 460,
            margin: "0 20px",
            height: 28,
            borderRadius: 7,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "0 12px",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
              letterSpacing: "0.01em",
            }}
          >
            app.vaxaivision.com
          </span>
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

      {/* Mobile fallback */}
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

      {/* iframe — shown on desktop */}
      <div
        style={{ flex: 1, position: "relative" }}
        className="demo-iframe-wrapper"
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
            {/* Animated pulse ring — matches DemoEmbed spinner */}
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
          src={DEMO_URL}
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
