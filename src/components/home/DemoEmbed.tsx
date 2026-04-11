"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

const DEMO_URL = "https://app.vaxaivision.com?demo=true";

const DemoEmbed = () => {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fallback: if onLoad doesn't fire within 5s, show iframe anyway
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      style={{
        position: "relative",
        background: "linear-gradient(180deg, #070e1b 0%, #0a1628 40%, #0d1f3c 100%)",
        padding: "100px 0 120px",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glows */}
      <div
        style={{
          position: "absolute",
          top: "-200px",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 16px",
              borderRadius: 100,
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.2)",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 14, color: "#60A5FA", fontWeight: 500 }}>
              Live Demo
            </span>
          </div>

          <h2
            style={{
              color: "#F1F5F9",
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              margin: "0 0 16px",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            See VaxAI Vision in Action
          </h2>
          <p
            style={{
              color: "#94A3B8",
              fontSize: "clamp(15px, 2vw, 18px)",
              margin: 0,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.7,
            }}
          >
            Explore the operational dashboard with real-time inventory tracking,
            cold chain monitoring, and predictive forecasting.
          </p>
        </div>

        {/* Desktop embed — browser chrome frame */}
        <div className="demo-embed-desktop">
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.04), 0 25px 80px -12px rgba(0,0,0,0.7), 0 0 120px -40px rgba(37,99,235,0.12)",
            }}
          >
            {/* Browser top bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 44,
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
                  flex: 1, maxWidth: 460, margin: "0 20px", height: 28, borderRadius: 7,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 12px",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace', letterSpacing: "0.01em" }}>
                  app.vaxaivision.com
                </span>
              </div>

              {/* Open full screen link */}
              <Link
                href="/demo"
                style={{
                  height: 28, padding: "0 12px", borderRadius: 6,
                  background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.25)",
                  color: "#60A5FA", fontSize: 12, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", textDecoration: "none", gap: 5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                Full Screen
              </Link>
            </div>

            {/* Iframe container */}
            <div style={{ position: "relative", height: 640 }}>
              {!loaded && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 10, background: "#0d1f3c" }}>
                  <div style={{ position: "relative", width: 48, height: 48 }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(37,99,235,0.15)" }} />
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#2563eb", animation: "demoSpin 0.8s linear infinite" }} />
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 500, margin: 0, letterSpacing: "0.02em" }}>
                    Loading live dashboard...
                  </p>
                </div>
              )}

              <iframe
                ref={iframeRef}
                src={DEMO_URL}
                title="VaxAI Vision Live Demo"
                onLoad={() => setLoaded(true)}
                style={{ width: "100%", height: "100%", border: "none", display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.6s ease" }}
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>

          <div style={{ height: 120, marginTop: -1, background: "linear-gradient(180deg, rgba(37,99,235,0.04) 0%, transparent 100%)", borderRadius: "0 0 16px 16px", filter: "blur(20px)", pointerEvents: "none" }} />
        </div>

        {/* Mobile fallback */}
        <div className="demo-embed-mobile" style={{ display: "none", flexDirection: "column", alignItems: "center", gap: 20, padding: "20px 0" }}>
          <div style={{ width: "100%", maxWidth: 400, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, #111827 0%, #0d1f3c 100%)", padding: "48px 28px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>
              \u{1F5A5}\uFE0F
            </div>
            <p style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 20, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Best on Desktop</p>
            <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>The VaxAI Vision dashboard is optimised for larger screens.</p>
            <Link href="/demo" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", borderRadius: 10, background: "linear-gradient(135deg, #2563eb, #0ea5e9)", color: "#fff", fontWeight: 600, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 14px rgba(37,99,235,0.35), 0 0 0 1px rgba(37,99,235,0.15)" }}>
              Open Live Demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes demoSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .demo-embed-desktop { display: none !important; }
          .demo-embed-mobile { display: flex !important; }
        }
      `}</style>
    </section>
  );
};

export default DemoEmbed;
