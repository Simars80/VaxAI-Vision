"use client";

import Layout from "@/components/layout";
import {
  Box,
  Center,
  Container,
  Grid,
  GridItem,
  Text,
  Button,
} from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";

/* Consolidated solution cards — same as homepage, with extended descriptions */
const allSolutions = [
  {
    title: "Real-Time Inventory Dashboard",
    emoji: "📦",
    short:
      "Monitor stock levels across every facility — colour-coded as adequate, low, or critical.",
    description:
      "Track vaccine inventory in real time across hundreds of facilities. Filter by vaccine type, country, or facility to spot shortfalls before they become stockouts. Colour-coded status indicators (adequate, low, critical) make it easy to prioritise action at a glance.",
    href: "/demo",
  },
  {
    title: "AI-Powered Forecasting",
    emoji: "📊",
    short:
      "Predict demand surges, flag expiring stock, and model what-if scenarios.",
    description:
      "Machine-learning models trained on historical consumption data forecast future demand with confidence intervals. Run what-if scenarios for outbreak response, flag stock nearing expiry, and generate optimised replenishment orders — reducing waste and preventing shortages.",
    href: "/demo?tab=forecasting",
  },
  {
    title: "Cold Chain Monitor",
    emoji: "❄️",
    short:
      "Live temperature readings with configurable alert thresholds and trend charts.",
    description:
      "IoT-connected sensors stream temperature data from cold storage units in real time. Set per-facility alert thresholds, view breach event timelines, and track min/max temperature trends over configurable periods. Keep every vial safe from factory to clinic.",
    href: "/demo",
  },
  {
    title: "Geospatial Coverage Map",
    emoji: "🗺️",
    short:
      "Interactive map showing immunisation coverage rates and stock status per facility.",
    description:
      "An interactive Leaflet map plots every facility from Kano to Kisumu. Zoom, pan, and filter by country, vaccine type, or time period to see coverage rates, stock status, and population density overlaid on a single view — making geographic gaps immediately visible.",
    href: "/demo",
  },
  {
    title: "AR Stock Counter",
    emoji: "📷",
    short:
      "Point your camera at vaccine shelves and let AI count and classify items in real time.",
    description:
      "Our augmented-reality scanner uses a YOLOv8 model to detect, classify, and count vaccine products directly from your device camera. Compare AR-scanned counts against system inventory for instant reconciliation — no manual tallying required.",
    href: "/demo?tab=ar-scanner",
  },
  {
    title: "Computer Vision Analytics",
    emoji: "🤖",
    short:
      "AI models detect, classify, and count stock — powering AR scans and batch image analysis.",
    description:
      "Purpose-built vision models trained on vaccine packaging power both the live AR scanner and batch image analysis for large-scale audits. Track model performance metrics, manage training runs, and monitor detection accuracy across different product types.",
    href: "/demo?tab=vision",
  },
  {
    title: "Data Ingestion Pipeline",
    emoji: "📤",
    short:
      "Import facility data from CSV, Excel, DHIS2, OpenLMIS, or mSupply.",
    description:
      "Upload inventory snapshots, cold chain readings, or coverage data via CSV/Excel, or connect directly to national health information systems like DHIS2, OpenLMIS, and mSupply. Track ingestion jobs with row-level success/failure reporting.",
    href: "/demo",
  },
  {
    title: "Impact Reports",
    emoji: "📈",
    short:
      "Generate donor-ready reports on coverage improvements and waste reduction.",
    description:
      "Automatically compile key performance indicators — doses administered, coverage rate changes, waste reduction, cold chain uptime — into structured reports suitable for government reviews, donor reporting, and internal performance tracking.",
    href: "/demo",
  },
];

const SolutionsPage = () => {
  return (
    <Layout>
      {/* Page header */}
      <Box bg="#FBFBFB" py={{ base: "37px", md: "55px" }}>
        <Container maxW="container.xl">
          <Center flexDir="column">
            <Text
              fontSize={{ base: "20px", md: "42px" }}
              fontWeight={700}
              textAlign="center"
              color="#1A1A1A"
            >
              Our Solutions
            </Text>
            <Text
              textAlign="center"
              mt="12px"
              color="#667085"
              fontSize={{ base: "14px", md: "16px" }}
              maxW="640px"
            >
              An end-to-end platform for vaccine supply chain intelligence — from
              cold storage to last-mile delivery.
            </Text>
          </Center>
        </Container>
      </Box>

      {/* Solution cards */}
      <Box mt={{ base: "32px", md: "64px" }} mb={{ base: "40px", md: "100px" }}>
        <Container maxW="container.xl">
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }}
            gap={{ base: "20px", md: "28px" }}
          >
            <Slide direction="up" damping={0.1} cascade triggerOnce>
              {allSolutions.map((sol, idx) => (
                <GridItem key={idx}>
                  <Box
                    p="28px"
                    borderRadius="12px"
                    border="1px solid #DEE5ED"
                    bg="#fff"
                    h="full"
                    display="flex"
                    flexDir="column"
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "#3A5BCC",
                      boxShadow: "0 4px 20px rgba(58,91,204,0.08)",
                      transform: "translateY(-2px)",
                    }}
                  >
                    <Text fontSize="40px" mb="4px">
                      {sol.emoji}
                    </Text>
                    <Text
                      mt="12px"
                      mb="10px"
                      color="#1A1A1A"
                      fontSize="18px"
                      fontWeight={700}
                    >
                      {sol.title}
                    </Text>
                    <Text
                      color="#667085"
                      fontSize="14px"
                      fontWeight={400}
                      lineHeight={1.7}
                      flex="1"
                    >
                      {sol.description}
                    </Text>
                    <Link href={sol.href}>
                      <Button
                        bg="#3A5BCC"
                        h="46px"
                        borderRadius="10px"
                        mt="24px"
                        color="#fff"
                        fontSize="14px"
                        fontWeight={500}
                        _hover={{ opacity: 0.85 }}
                      >
                        Try it Live →
                      </Button>
                    </Link>
                  </Box>
                </GridItem>
              ))}
            </Slide>
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
};

export default SolutionsPage;
