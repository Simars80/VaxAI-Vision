"use client";

import React, { useState } from "react";
import Link from "next/link";

const DEMO_URL = "https://app.vaxaivision.com?demo=true";
const TOPBAR_HEIGHT = 48;

export default function DemoPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628" }}>
      {/* Top bar */}
      <div
        style={{
          height: TOPBAR_HEIGHT,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "#0d1f3c",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            V
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>VaxAI Vision</span>
          <span
            style={{
              marginLeft: 8,
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
        </div>

        {/* Exit Demo */}
        <Link
          href="/"
          style={{
            height: 30,
            padding: "0 14px",
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11 }}>✕</span> Exit Demo
        </Link>
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
              gap: 12,
              zIndex: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                border: "3px solid rgba(37,99,235,0.3)",
                borderTopColor: "#2563eb",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
              Loading live dashboard…
            </p>
          </div>
        )}
        <iframe
          src={DEMO_URL}
          title="VaxAI Vision Live Demo"
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <style>{`
        @keyframes spin {
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
