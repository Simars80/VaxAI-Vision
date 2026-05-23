"use client";

import React from "react";
import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import Link from "next/link";
import Layout from "@/components/layout";
import { Slide } from "react-awesome-reveal";
import PageHero from "@/components/_shared/PageHero";
import TrustStrip from "@/components/home/trustStrip";
import CtaBand from "@/components/home/ctaBand";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

/* Same content as before, plus two extra surfaces (ingestion, reports). */
const allSolutions = [
  {
    n: "01",
    title: "Real-time inventory dashboard",
    short: "Live stock levels across every facility — adequate, low, critical.",
    description:
      "Track vaccine inventory in real time across hundreds of facilities. Filter by vaccine type, country, or facility to spot shortfalls before they become stockouts. Colour-coded status indicators (adequate, low, critical) make it easy to prioritise action at a glance.",
    href: "/demo",
    slug: "Real-Time-Stock-Verification",
    stat: "1,240 facilities online",
  },
  {
    n: "02",
    title: "AI-powered forecasting",
    short: "Prophet + LightGBM ensemble per facility.",
    description:
      "Machine-learning models trained on historical consumption data forecast future demand with confidence intervals. Run what-if scenarios for outbreak response, flag stock nearing expiry, and generate optimised replenishment orders — reducing waste and preventing shortages.",
    href: "/demo?tab=forecasting",
    slug: "Data-Driven-Analytics",
    stat: "12-week horizon · 80% CI",
  },
  {
    n: "03",
    title: "Cold chain monitor",
    short: "Live temperature telemetry with breach timelines.",
    description:
      "IoT-connected sensors stream temperature data from cold storage units in real time. Set per-facility alert thresholds, view breach event timelines, and track min/max temperature trends over configurable periods. Keep every vial safe from factory to clinic.",
    href: "/demo",
    slug: "Integrated-Equipment-Monitoring",
    stat: "98.7% chain uptime",
  },
  {
    n: "04",
    title: "Geospatial coverage map",
    short: "Coverage rates and stock status per facility.",
    description:
      "An interactive Leaflet map plots every facility from Kano to Kisumu. Zoom, pan, and filter by country, vaccine type, or time period to see coverage rates, stock status, and population density overlaid on a single view — making geographic gaps immediately visible.",
    href: "/impact",
    slug: "Real-Time-Data-Access-and-Sharing",
    stat: "11 country programmes",
  },
  {
    n: "05",
    title: "AR stock counter",
    short: "YOLOv8 + ByteTrack counts vials in real time.",
    description:
      "Our augmented-reality scanner uses a YOLOv8 model to detect, classify, and count vaccine products directly from your device camera. Compare AR-scanned counts against system inventory for instant reconciliation — no manual tallying required.",
    href: "/demo?tab=ar-scanner",
    slug: "Real-Time-Stock-Verification",
    stat: "<100 ms inference",
  },
  {
    n: "06",
    title: "Computer vision analytics",
    short: "VVM classifier + batch image audits.",
    description:
      "Purpose-built vision models trained on vaccine packaging power both the live AR scanner and batch image analysis for large-scale audits. Track model performance metrics, manage training runs, and monitor detection accuracy across different product types.",
    href: "/demo?tab=vision",
    slug: "Enhanced-Safety-and-Compliance",
    stat: "4-stage VVM classification",
  },
  {
    n: "07",
    title: "Data ingestion pipeline",
    short: "CSV, Excel, DHIS2, mSupply, OpenLMIS, FHIR.",
    description:
      "Upload inventory snapshots, cold chain readings, or coverage data via CSV/Excel, or connect directly to national health information systems like DHIS2, OpenLMIS, and mSupply. Track ingestion jobs with row-level success/failure reporting.",
    href: "/demo",
    slug: "Operational-Efficiency-and-Waste-Reduction",
    stat: "Bi-directional sync",
  },
  {
    n: "08",
    title: "Impact reports",
    short: "Donor-ready KPI exports.",
    description:
      "Automatically compile key performance indicators — doses administered, coverage rate changes, waste reduction, cold chain uptime — into structured reports suitable for government reviews, donor reporting, and internal performance tracking.",
    href: "/impact",
    slug: "Scalability-and-Adaptability",
    stat: "Quarterly + ad-hoc",
  },
];

const SolutionsPage = () => {
  return (
    <Layout>
      <PageHero
        eyebrow="The platform"
        title={
          <>
            Eight surfaces, one calm interface.
          </>
        }
        sub="An end-to-end platform for vaccine supply chain intelligence — from cold storage to last-mile delivery. Adopt the surfaces you need; your existing LMIS keeps working underneath."
      />

      <TrustStrip />

      <Box bg={tokens.bg} py={{ base: "48px", md: "80px" }}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Box borderTop={`1px solid ${tokens.rule}`}>
            <Slide direction="up" damping={0.06} cascade triggerOnce>
              <Grid
                templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
                gap="0"
              >
                {allSolutions.map((c, i) => (
                  <GridItem
                    key={c.n}
                    bg="#fff"
                    padding="36px 32px"
                    borderRight={{
                      base: "none",
                      md: i % 2 === 1 ? "none" : `1px solid ${tokens.rule}`,
                      lg: i % 3 === 2 ? "none" : `1px solid ${tokens.rule}`,
                    }}
                    borderBottom={`1px solid ${tokens.rule}`}
                    display="flex"
                    flexDir="column"
                    _hover={{ bg: "#fafbfd" }}
                    transition="background 0.2s ease"
                  >
                    <Flex justifyContent="space-between" alignItems="baseline" mb="20px">
                      <Text
                        className="vax-mono"
                        fontSize="11px"
                        color={tokens.brand}
                        letterSpacing="0.14em"
                      >
                        {c.n}
                      </Text>
                      <Text
                        className="vax-mono"
                        fontSize="10px"
                        color={tokens.muted}
                        letterSpacing="0.12em"
                        textTransform="uppercase"
                      >
                        {c.stat}
                      </Text>
                    </Flex>
                    <Text
                      fontWeight={600}
                      fontSize="22px"
                      letterSpacing="-0.015em"
                      mb="10px"
                    >
                      {c.title}
                    </Text>
                    <Text fontSize="14px" lineHeight="1.65" color={tokens.muted} mb="20px" flex="1">
                      {c.description}
                    </Text>
                    <Flex gap="20px" alignItems="center">
                      <Link href={c.href} className="vax-link" style={{ fontSize: 13, fontWeight: 500 }}>
                        Try it live →
                      </Link>
                      <Link
                        href={`/solutions/${c.slug}`}
                        style={{ fontSize: 13, fontWeight: 500, color: tokens.muted }}
                      >
                        Deep-dive
                      </Link>
                    </Flex>
                  </GridItem>
                ))}
              </Grid>
            </Slide>
          </Box>

          <Box mt="48px" padding="28px 32px" border={`1px solid ${tokens.rule}`} borderRadius="10px"
               bg="#fafbfd" textAlign="center">
            <Eyebrow>Want to see them in one session?</Eyebrow>
            <Text mt="14px" fontSize={{ base: "20px", md: "26px" }} fontWeight={600} letterSpacing="-0.015em">
              Walk through the platform end-to-end in our 90-second live demo.
            </Text>
            <Box mt="20px" display="inline-flex" gap="12px" flexWrap="wrap" justifyContent="center">
              <Link
                href="/demo"
                style={{
                  background: tokens.brand,
                  color: "#fff",
                  padding: "14px 24px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 4px 14px rgba(58,91,204,0.22)",
                }}
              >
                ▶ Launch live demo
              </Link>
              <Link
                href="/contact"
                style={{
                  border: `1px solid ${tokens.rule}`,
                  color: tokens.ink,
                  padding: "14px 24px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  background: "#fff",
                }}
              >
                Talk to us
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>

      <CtaBand />
    </Layout>
  );
};

export default SolutionsPage;
