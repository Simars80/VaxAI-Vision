"use client";

import React, { useEffect, useState } from "react";

export default function DashboardPreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const bars = [72, 58, 84, 91, 63, 77, 88, 55, 79, 95, 68, 82];
  const animatedBars = bars.map((_v, i) => {
    const offset = (tick + i) % bars.length;
    return bars[offset];
  });

  const stats = [
    { label: "Doses Tracked", value: "2.4M", change: "+12%", color: "#34D399" },
    { label: "Cold Chain OK", value: "98.7%", change: "+0.3%", color: "#60A5FA" },
    { label: "Facilities", value: "1,240", change: "+8", color: "#A78BFA" },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        background: "#0F172A",
        border: "1px solid #1E293B",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        userSelect: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 14px",
          background: "#1E293B",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", opacity: 0.7 }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981", opacity: 0.7 }} />
        <div
          style={{
            marginLeft: 8,
            flex: 1,
            background: "#0F172A",
            borderRadius: 4,
            padding: "3px 10px",
            fontSize: 11,
            color: "#64748B",
          }}
        >
          app.vaxaivision.com/dashboard
        </div>
        <div
          style={{
            padding: "2px 8px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            fontSize: 10,
            color: "#34D399",
            fontWeight: 600,
          }}
        >
          ● Live
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", height: "calc(100% - 36px)" }}>
        {/* Sidebar */}
        <div
          style={{
            width: 48,
            background: "#1E293B",
            borderRight: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 12,
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#3A5BCC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            V
          </div>
          {["▤", "◈", "⊞", "◎", "❄"].map((icon, i) => (
            <div
              key={i}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: i === 0 ? "#60A5FA" : "#475569",
                background: i === 0 ? "rgba(96,165,250,0.1)" : "transparent",
              }}
            >
              {icon}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "12px", overflow: "hidden" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ color: "#F1F5F9", fontSize: 12, fontWeight: 600 }}>
                Operations Overview
              </div>
              <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
                Live · Updated just now
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <div
                style={{
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  fontSize: 9,
                  color: "#34D399",
                }}
              >
                Live
              </div>
              <div
                style={{
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "#1E293B",
                  fontSize: 9,
                  color: "#64748B",
                }}
              >
                Export
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 6,
              marginBottom: 10,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#1E293B",
                  borderRadius: 8,
                  padding: "8px",
                  border: "1px solid #334155",
                }}
              >
                <div style={{ fontSize: 9, color: "#64748B", marginBottom: 3 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: "#34D399" }}>{s.change}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div
            style={{
              background: "#1E293B",
              borderRadius: 8,
              padding: "8px",
              border: "1px solid #334155",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 9, color: "#64748B", marginBottom: 8 }}>
              Vaccination Coverage — Last 12 Months
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 3,
                height: 48,
              }}
            >
              {animatedBars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    borderRadius: "2px 2px 0 0",
                    background:
                      i === animatedBars.length - 1
                        ? "#3A5BCC"
                        : `rgba(58,91,204,${0.3 + (h / 100) * 0.5})`,
                    transition: "height 0.6s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div
              style={{
                background: "#1E293B",
                borderRadius: 8,
                padding: "8px",
                border: "1px solid #334155",
              }}
            >
              <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6 }}>
                Cold Chain Status
              </div>
              {[
                { label: "Lagos Hub", ok: true },
                { label: "Kano Facility", ok: true },
                { label: "Nairobi Store", ok: false },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    color: "#94A3B8",
                    marginBottom: 3,
                  }}
                >
                  <span>{f.label}</span>
                  <span style={{ color: f.ok ? "#34D399" : "#F87171" }}>
                    {f.ok ? "✓ OK" : "⚠ Alert"}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                background: "#1E293B",
                borderRadius: 8,
                padding: "8px",
                border: "1px solid #334155",
              }}
            >
              <div style={{ fontSize: 9, color: "#64748B", marginBottom: 6 }}>
                Stock Levels
              </div>
              {[
                { label: "BCG", pct: 82 },
                { label: "OPV", pct: 45 },
                { label: "Measles", pct: 91 },
              ].map((v) => (
                <div key={v.label} style={{ marginBottom: 5 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9,
                      color: "#94A3B8",
                      marginBottom: 2,
                    }}
                  >
                    <span>{v.label}</span>
                    <span>{v.pct}%</span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: "#0F172A",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${v.pct}%`,
                        height: "100%",
                        background:
                          v.pct > 70 ? "#34D399" : v.pct > 40 ? "#F59E0B" : "#EF4444",
                        borderRadius: 2,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
