import React from "react";
import { Metadata } from "next";
import Layout from "@/components/layout";
import ImpactHero from "@/components/impact/ImpactHero";
import ProblemStatement from "@/components/impact/ProblemStatement";
import ImpactMetrics from "@/components/impact/ImpactMetrics";
import CoverageMap from "@/components/impact/CoverageMap";
import TheAsk from "@/components/impact/TheAsk";

export const metadata: Metadata = {
  title: "VaxAI Vision | Impact — Donor & Grant Brief",
  description:
    "VaxAI is ending vaccine stockouts across Africa. See our coverage map, impact metrics, and funding opportunities.",
  openGraph: {
    title: "VaxAI Vision — Ending Vaccine Stockouts Across Africa",
    description:
      "340+ health facilities covered. 63% stockout reduction. $2M raise to scale across 10 African countries by 2026.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaxAI Vision — Ending Vaccine Stockouts Across Africa",
    description:
      "340+ health facilities covered. 63% stockout reduction. $2M raise to scale across 10 African countries by 2026.",
  },
};

const ImpactPage = () => {
  return (
    <Layout>
      <ImpactHero />
      <ProblemStatement />
      <ImpactMetrics />
      <CoverageMap />
      <TheAsk />
    </Layout>
  );
};

export default ImpactPage;
