"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

const DEMO_URL = "https://app.vaxaivision.com";

const DemoEmbed = () => {
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fallback: if onLoad doesn't fire within 6s, show iframe anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section
      style={{
        background: "#0a1628",
        padding: "80px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2
            style={{
              color: "#F1F5F9",
              fontSize: "clamp(24px, 4vw, 40px)",
              fontWeight: 800,
              margin: "0 0 12px",
              letterSpacing: "-0.02em",
            }}
          >
            See VaxAI Vision in Action
          </h2>
          <p
            style={{
              color: "#94A3B8",
              fontSize: "clamp(14px, 2vw, 17px)",
              margin: 0,
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            Explore the live operational dashboard — real data, zero login required.
          </p>
        </div>

        {/* Desktop embed */}
        <div className="demo-embed-desktop">
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#0d1f3c",
              height: 680,
            }}
          >
            {/* Open full screen link */}
            <Link
              href="/demo"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 20,
                height: 30,
                padding: "0 12px",
                borderRadius: 7,
                background: "rgba(13,31,60,0.85)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.75)",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                gap: 5,
                backdropFilter: "blur(8px)",
              }}
            >
              ⛶ Open full screen
            </Link>

            {/* Loading spinner */}
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
                  background: "#0d1f3c",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: "3px solid rgba(37,99,235,0.3)",
                    borderTopColor: "#2563eb",
                    borderRadius: "50%",
                    animation: "demoSpin 0.8s linear infinite",
                  }}
                />
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
                  Loading live dashboard…
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
                transition: "opacity 0.5s ease",
              }}
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>

        {/* Mobile fallback */}
        <div
          className="demo-embed-mobile"
          style={{
            display: "none",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            padding: "20px 0",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#0d1f3c",
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
            <p style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>
              Best experienced on desktop
            </p>
            <p style={{ color: "#94A3B8", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
              The VaxAI Vision dashboard is optimised for wider screens.
            </p>
            <Link
              href="/demo"
              style={{
                display: "inline-block",
                padding: "12px 28px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Try the Live Demo →
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
