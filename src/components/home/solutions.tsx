"use client";

import {
  Box,
  Center,
  Container,
  Flex,
  Grid,
  GridItem,
  Text,
} from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";
import { tokens } from "./_tokens";
import { Eyebrow, CTA } from "./_atoms";

const cards = [
  {
    n: "01",
    title: "Real-time inventory",
    desc: "Live stock levels across every facility, colour-coded as adequate, low, or critical. Filter by vaccine, country, or facility — spot shortfalls before they become stockouts.",
    cta: "Explore inventory →",
    stat: "1,240 facilities online",
    href: "/demo",
  },
  {
    n: "02",
    title: "AI-powered forecasting",
    desc: "A Prophet + LightGBM ensemble predicts demand surges, flags expiring stock, and models what-if scenarios per facility. Order the right quantity at the right time.",
    cta: "View forecasts →",
    stat: "12-week horizon · 80% CI",
    href: "/demo?tab=forecasting",
  },
  {
    n: "03",
    title: "Cold chain monitoring",
    desc: "Continuous temperature telemetry with configurable thresholds, breach timelines, and excursion alerts routed to the right responder.",
    cta: "See cold chain →",
    stat: "98.7% chain uptime",
    href: "/demo",
  },
  {
    n: "04",
    title: "AR stock counter",
    desc: "Point a phone camera at a shelf — YOLOv8 counts vials, syringes, cold boxes, and ancillaries in real time and reconciles against the ledger.",
    cta: "Try AR scanner →",
    stat: "<100 ms inference",
    href: "/demo?tab=ar-scanner",
  },
  {
    n: "05",
    title: "VVM stage classifier",
    desc: "A computer-vision model reads vaccine vial monitor indicators and flags heat-exposed vials (Stage 1 through 4) at the point of dispensing.",
    cta: "Explore vision AI →",
    stat: "4-stage classification",
    href: "/demo?tab=vision",
  },
  {
    n: "06",
    title: "Coverage intelligence",
    desc: "Interactive geospatial maps showing immunisation coverage by district and facility. Drill from country to clinic in a few clicks.",
    cta: "View coverage map →",
    stat: "11 country programmes",
    href: "/demo",
  },
];

const Solutions = () => {
  return (
    <Box bg={tokens.bg} py={{ base: "64px", md: "110px" }} id="solutions">
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        {/* section header */}
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1.2fr" }}
          gap={{ base: "24px", md: "48px" }}
          mb="56px"
        >
          <GridItem>
            <Eyebrow>The platform</Eyebrow>
            <Text
              as="h2"
              mt="14px"
              fontWeight={600}
              fontSize={{ base: "32px", md: "46px" }}
              lineHeight="1.05"
              letterSpacing="-0.03em"
            >
              One platform.
              <br />
              Six surfaces.
            </Text>
          </GridItem>
          <GridItem alignSelf="end">
            <Text
              fontSize={{ base: "15px", md: "16px" }}
              lineHeight="1.65"
              color={tokens.muted}
              maxW="540px"
            >
              Each module ships independently and integrates through the same data layer.
              Adopt one, adopt all — your existing LMIS keeps working underneath.
            </Text>
          </GridItem>
        </Grid>

        <Box borderTop={`1px solid ${tokens.rule}`}>
          <Slide direction="up" damping={0.06} cascade triggerOnce>
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
              gap="0"
            >
              {cards.map((c, i) => (
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
                  position="relative"
                  transition="background 0.2s ease"
                  _hover={{ bg: "#fafbfd" }}
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
                    mb="12px"
                  >
                    {c.title}
                  </Text>
                  <Text fontSize="14px" lineHeight="1.6" color={tokens.muted} mb="24px">
                    {c.desc}
                  </Text>
                  <Link href={c.href} className="vax-link" style={{ fontSize: 13, fontWeight: 500 }}>
                    {c.cta}
                  </Link>
                </GridItem>
              ))}
            </Grid>
          </Slide>
        </Box>

        <Center mt="48px" flexDir="column" gap="14px">
          <Text fontSize="14px" color={tokens.muted}>
            Want the technical deep-dive on any module?
          </Text>
          <Link href="/solutions">
            <CTA variant="ghost">Read the platform docs →</CTA>
          </Link>
        </Center>
      </Container>
    </Box>
  );
};

export default Solutions;
