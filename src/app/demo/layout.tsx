import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VaxAI Vision — Live Demo",
  description:
    "Experience VaxAI Vision's real-time vaccine supply chain intelligence. Explore inventory, cold chain monitoring, and geospatial coverage maps.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // Full-screen layout: no site nav or footer
  return (
    <html lang="en" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
