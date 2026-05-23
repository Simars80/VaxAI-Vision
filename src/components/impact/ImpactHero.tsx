"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow, CTA } from "@/components/home/_atoms";

const ImpactHero = () => {
  return (
    <Box bg={tokens.navBg} color="#fff" py={{ base: "80px", md: "120px" }} position="relative" overflow="hidden">
      {/* faint grid */}
      <Box position="absolute" sx={{
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        pointerEvents: "none",
      }} />

      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }} sx={{ position: "relative" }}>
        <Grid templateColumns={{ base: "1fr", md: "1.2fr 1fr" }} gap={{ base: "40px", md: "64px" }} alignItems="end">
          <GridItem>
            <Eyebrow color="#9aa6cf">Grant &amp; donor brief · 2026</Eyebrow>
            <Text as="h1" mt="22px" fontWeight={600}
                  fontSize={{ base: "40px", md: "68px" }}
                  lineHeight="1.0" letterSpacing="-0.035em" sx={{ textWrap: "balance" }}>
              Ending vaccine stockouts <Box as="span" color={tokens.brand} sx={{ filter: "brightness(1.6)" }}>across Africa</Box>.
            </Text>
            <Text mt="22px" fontSize={{ base: "16px", md: "18px" }} lineHeight="1.6"
                  color="rgba(255,255,255,0.7)" maxW="540px" sx={{ textWrap: "pretty" }}>
              VaxAI Vision is an AI-powered platform that gives healthcare facilities real-time
              visibility into vaccine inventory — slashing stockouts, reducing waste, and helping
              governments deliver equitable immunisation at scale.
            </Text>
            <Flex gap="12px" mt="32px" flexWrap="wrap">
              <Link href="#ask" style={{
                background: tokens.brand, color: "#fff", padding: "15px 26px",
                borderRadius: 6, fontSize: 15, fontWeight: 600,
                boxShadow: "0 4px 14px rgba(58,91,204,0.22)",
              }}>See the ask →</Link>
              <Link href="#coverage" style={{
                background: "transparent", color: "#fff",
                padding: "15px 26px", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.3)",
                fontSize: 15, fontWeight: 500,
              }}>View coverage map</Link>
            </Flex>
          </GridItem>

          <GridItem>
            <Box pt="20px" borderTop="1px solid rgba(255,255,255,0.18)">
              <Grid templateColumns="repeat(2, 1fr)" gap="0">
                {[
                  ["340+", "Facilities covered"],
                  ["1.2M+", "Doses tracked"],
                  ["63%", "Stockout reduction"],
                  ["$2M", "Raise target"],
                ].map(([v, l], i) => (
                  <GridItem key={l}
                    padding="24px 0"
                    borderRight={i % 2 === 0 ? "1px solid rgba(255,255,255,0.12)" : "none"}
                    paddingLeft={i % 2 === 1 ? "24px" : 0}
                    paddingRight={i % 2 === 0 ? "24px" : 0}
                    borderBottom={i < 2 ? "1px solid rgba(255,255,255,0.12)" : "none"}>
                    <Text fontWeight={600} fontSize="36px" letterSpacing="-0.025em" className="vax-tabular">{v}</Text>
                    <Text mt="4px" fontSize="11px" color="rgba(255,255,255,0.6)" letterSpacing="0.06em" textTransform="uppercase">{l}</Text>
                  </GridItem>
                ))}
              </Grid>
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default ImpactHero;
