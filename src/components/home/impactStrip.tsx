"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";
import { Eyebrow } from "./_atoms";

const stats: Array<[string, string, string]> = [
  ["2.41M", "Doses tracked", "+18.4% YoY"],
  ["1,240", "Facilities live", "Across 11 countries"],
  ["98.7%", "Cold-chain uptime", "+0.6pp vs baseline"],
  ["$4.1M", "Wastage avoided", "Modelled across pilots"],
];

const ImpactStrip = () => {
  return (
    <Box id="impact" bg={tokens.navBg} color="#fff" py={{ base: "64px", md: "96px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap="40px"
          alignItems="end"
          mb="48px"
        >
          <GridItem>
            <Eyebrow color="#9aa6cf">Impact to date</Eyebrow>
            <Text
              as="h2"
              mt="14px"
              fontWeight={600}
              fontSize={{ base: "32px", md: "52px" }}
              lineHeight="1.02"
              letterSpacing="-0.03em"
              color="#fff"
            >
              Real programmes.
              <br />
              Real{" "}
              <Box as="span" color={tokens.brand} sx={{ filter: "brightness(1.6)" }}>
                numbers
              </Box>
              .
            </Text>
          </GridItem>
          <GridItem>
            <Text
              fontSize="16px"
              lineHeight="1.65"
              color="rgba(255,255,255,0.65)"
              maxW="500px"
            >
              Aggregated across active deployments since 2023. Programme-level dashboards
              with country breakdowns available to partners and donors on request.
            </Text>
          </GridItem>
        </Grid>

        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap="0"
          borderTop="1px solid rgba(255,255,255,0.12)"
          borderBottom="1px solid rgba(255,255,255,0.12)"
        >
          {stats.map(([v, l, d], i, arr) => (
            <GridItem
              key={l}
              padding={{ base: "28px 8px", md: "40px 28px" }}
              borderRight={{
                base: i % 2 === 1 ? "none" : "1px solid rgba(255,255,255,0.12)",
                md:
                  i === arr.length - 1
                    ? "none"
                    : "1px solid rgba(255,255,255,0.12)",
              }}
              borderBottom={{
                base: i < 2 ? "1px solid rgba(255,255,255,0.12)" : "none",
                md: "none",
              }}
            >
              <Text
                fontWeight={600}
                fontSize={{ base: "32px", md: "52px" }}
                letterSpacing="-0.025em"
                color="#fff"
                className="vax-tabular"
              >
                {v}
              </Text>
              <Text mt="6px" fontSize="13px" color="rgba(255,255,255,0.85)" fontWeight={500}>
                {l}
              </Text>
              <Text
                mt="6px"
                fontSize="11px"
                color="rgba(255,255,255,0.5)"
                className="vax-mono"
                letterSpacing="0.06em"
              >
                {d}
              </Text>
            </GridItem>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ImpactStrip;
