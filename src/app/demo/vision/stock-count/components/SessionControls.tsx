"use client";

interface SessionControlsProps {
  status: "active" | "paused" | "submitted" | "draft";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSubmit: () => void;
  elapsedSeconds: number;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function SessionControls({
  status,
  onStart,
  onPause,
  onResume,
  onSubmit,
  elapsedSeconds,
}: SessionControlsProps) {
  const btnBase: React.CSSProperties = {
    height: 36,
    padding: "0 16px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s ease",
  };

  return (
    <div
      style={{
        background: "rgba(10,22,40,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {status !== "draft" && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            fontWeight: 700,
            color: status === "active" ? "#10b981" : "rgba(255,255,255,0.5)",
            minWidth: 56,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatElapsed(elapsedSeconds)}
        </div>
      )}

      {status === "draft" && (
        <button onClick={onStart} style={{ ...btnBase, background: "#2563eb", color: "#fff" }}>
          <span style={{ fontSize: 14 }}>▶</span> Start Count
        </button>
      )}

      {status === "active" && (
        <>
          <button
            onClick={onPause}
            style={{ ...btnBase, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            ⏸ Pause
          </button>
          <button
            onClick={onSubmit}
            style={{ ...btnBase, background: "#10b981", color: "#fff", marginLeft: "auto" }}
          >
            ✓ Submit
          </button>
        </>
      )}

      {status === "paused" && (
        <>
          <button
            onClick={onResume}
            style={{ ...btnBase, background: "#2563eb", color: "#fff" }}
          >
            ▶ Resume
          </button>
          <button
            onClick={onSubmit}
            style={{ ...btnBase, background: "#10b981", color: "#fff", marginLeft: "auto" }}
          >
            ✓ Submit
          </button>
        </>
      )}

      {status === "submitted" && (
        <span style={{ color: "#10b981", fontSize: 13, fontWeight: 600 }}>✓ Submitted</span>
      )}

      {status !== "draft" && (
        <div
          style={{
            marginLeft: status === "submitted" ? "auto" : 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                status === "active" ? "#10b981" : status === "paused" ? "#f59e0b" : "#6b7280",
              animation: status === "active" ? "status-pulse 1.5s ease infinite" : "none",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "capitalize" }}>
            {status}
          </span>
        </div>
      )}

      <style>{`
        @keyframes status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
