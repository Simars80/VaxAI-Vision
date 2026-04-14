"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AROverlay from "../components/AROverlay";
import DetectionLayer from "../components/DetectionLayer";
import CountTally from "../components/CountTally";
import BarcodeScanner from "../components/BarcodeScanner";
import SessionControls from "../components/SessionControls";
import { runDemoInference, resetInference, loadModel } from "../lib/inference";
import {
  createSession,
  getSession,
  addDetections,
  pauseSession,
  resumeSession,
  submitSession,
} from "../lib/session-store";
import type { Detection, ProductTally } from "../lib/types";

export default function ScanPage() {
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"draft" | "active" | "paused" | "submitted">("draft");
  const [detections, setDetections] = useState<Detection[]>([]);
  const [tallies, setTallies] = useState<ProductTally[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  const [useWebXR, setUseWebXR] = useState(false);
  const [webXRAvailable, setWebXRAvailable] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "xr" in navigator) {
      (navigator as Navigator & { xr: { isSessionSupported: (mode: string) => Promise<boolean> } })
        .xr.isSessionSupported("immersive-ar")
        .then((supported: boolean) => setWebXRAvailable(supported))
        .catch(() => setWebXRAvailable(false));
    }
  }, []);

  useEffect(() => {
    const existingId = searchParams.get("session");
    if (existingId) {
      const existing = getSession(existingId);
      if (existing) {
        setSessionId(existing.id);
        setSessionStatus(existing.status);
        setTallies([...existing.tallies]);
        setTotalDetections(existing.detections.length);
      }
    }
  }, [searchParams]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          const vw = videoRef.current!.videoWidth;
          const vh = videoRef.current!.videoHeight;
          setDimensions({ width: vw, height: vh });
          setCameraReady(true);
        };
      }
    } catch {
      setCameraError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const runDetectionLoop = useCallback(() => {
    if (!videoRef.current || !cameraReady || sessionStatus !== "active") return;

    const dets = runDemoInference(videoRef.current, dimensions.width, dimensions.height);
    setDetections(dets);

    if (sessionId) {
      const newDets = dets.filter(
        (d) => !detections.some((existing) => existing.id === d.id)
      );
      if (newDets.length > 0) {
        addDetections(sessionId, newDets);
        const session = getSession(sessionId);
        if (session) {
          setTallies([...session.tallies]);
          setTotalDetections(session.detections.length);
        }
      }
    }

    animRef.current = requestAnimationFrame(runDetectionLoop);
  }, [cameraReady, sessionStatus, sessionId, dimensions, detections]);

  useEffect(() => {
    if (sessionStatus === "active" && cameraReady) {
      animRef.current = requestAnimationFrame(runDetectionLoop);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [sessionStatus, cameraReady, runDetectionLoop]);

  useEffect(() => {
    if (sessionStatus !== "active") return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionStatus]);

  const handleStart = async () => {
    setModelLoading(true);
    await loadModel("demo");
    resetInference();
    const session = createSession("Demo Warehouse Facility");
    setSessionId(session.id);
    setSessionStatus("active");
    setModelLoading(false);
    setElapsed(0);
  };

  const handlePause = () => {
    if (sessionId) pauseSession(sessionId);
    setSessionStatus("paused");
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  const handleResume = () => {
    if (sessionId) resumeSession(sessionId);
    setSessionStatus("active");
  };

  const handleSubmit = () => {
    if (sessionId) submitSession(sessionId);
    setSessionStatus("submitted");
    if (animRef.current) cancelAnimationFrame(animRef.current);
    stopCamera();
  };

  const handleBarcodeScan = (code: string, _format: string) => {
    console.log("Barcode scanned:", code);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0a1628", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          height: 48,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "#0d1f3c",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/demo/vision/stock-count"
            style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}
          >
            ← Sessions
          </Link>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>AR Scanner</span>
          {webXRAvailable && (
            <button
              onClick={() => setUseWebXR(!useWebXR)}
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                borderRadius: 4,
                border: `1px solid ${useWebXR ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.15)"}`,
                background: useWebXR ? "rgba(139,92,246,0.15)" : "transparent",
                color: useWebXR ? "#8b5cf6" : "rgba(255,255,255,0.5)",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              WebXR {useWebXR ? "ON" : "OFF"}
            </button>
          )}
        </div>

        {sessionStatus === "submitted" && sessionId && (
          <Link
            href={`/demo/vision/stock-count/review?session=${sessionId}`}
            style={{
              height: 30,
              padding: "0 14px",
              borderRadius: 7,
              background: "#8b5cf6",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              gap: 4,
            }}
          >
            View Results →
          </Link>
        )}
      </div>

      {/* Camera viewport */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} ref={containerRef}>
        {cameraError ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 40 }}>📷</div>
            <p style={{ color: "#ef4444", fontSize: 14, margin: 0 }}>{cameraError}</p>
            <button
              onClick={startCamera}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
              }}
            />

            {/* Scanning grid overlay */}
            {sessionStatus === "active" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.08) 1px, transparent 1px)",
                  backgroundSize: "60px 60px",
                  pointerEvents: "none",
                }}
              />
            )}

            {/* AR Overlay */}
            <AROverlay detections={detections} width={dimensions.width} height={dimensions.height} />

            {/* Detection Layer (HTML-based) */}
            <DetectionLayer
              detections={detections}
              containerWidth={dimensions.width}
              containerHeight={dimensions.height}
            />

            {/* Loading indicator */}
            {modelLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.7)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  zIndex: 15,
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
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0 }}>
                  Loading detection model…
                </p>
              </div>
            )}

            {/* HUD: Tally panel (top-right) */}
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, maxWidth: 240 }}>
              <CountTally tallies={tallies} totalDetections={totalDetections} />
            </div>

            {/* HUD: Barcode scanner (bottom-right) */}
            <div style={{ position: "absolute", bottom: 72, right: 12, zIndex: 10, maxWidth: 220 }}>
              <BarcodeScanner active={sessionStatus === "active"} onScan={handleBarcodeScan} />
            </div>

            {/* HUD: Session controls (bottom center) */}
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                minWidth: 300,
              }}
            >
              <SessionControls
                status={sessionStatus}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onSubmit={handleSubmit}
                elapsedSeconds={elapsed}
              />
            </div>

            {/* Crosshair */}
            {sessionStatus === "active" && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <div style={{ width: 32, height: 32, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 1, height: 10, background: "rgba(255,255,255,0.4)" }} />
                  <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 1, height: 10, background: "rgba(255,255,255,0.4)" }} />
                  <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 10, height: 1, background: "rgba(255,255,255,0.4)" }} />
                  <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 10, height: 1, background: "rgba(255,255,255,0.4)" }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
