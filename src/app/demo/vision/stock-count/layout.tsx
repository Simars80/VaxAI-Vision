import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VaxAI Vision — AR Stock Counter",
  description: "Augmented reality stock counting for vaccine warehouses. Scan, count, and reconcile inventory with AI-powered detection.",
};

export default function StockCountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
