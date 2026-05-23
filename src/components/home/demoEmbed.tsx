"use client";

import { Box, Center, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";
import { Eyebrow, CTA } from "./_atoms";

const sidebarItems = [
  "Overview",
  "Inventory",
  "Forecast",
  "Cold chain",
  "Vision",
  "Coverage map",
  "Reports",
  "Settings",
];

const kpis: Array<[string, string, string, string]> = [
  ["Doses tracked", "2.41M", "+18.4%", tokens.brand],
  ["Stock value", "$1.42M", "+6.1%", tokens.brand],
  ["Chain uptime", "98.7%", "+0.6pp", tokens.ok],
  ["Active alerts", "8", "−2", tokens.alert],
];

const DemoEmbed = () => {
  return (
    <Box
      id="platform"
      bg={tokens.bg}
      py={{ base: "64px", md: "110px" }}
      borderTop={`1px solid ${tokens.rule}`}
    >
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap="40px"
          mb="40px"
          alignItems="end"
        >
          <GridItem>
            <Eyebrow>Try it · live demo</Eyebrow>
            <Text
              as="h2"
              mt="14px"
              fontWeight={600}
              fontSize={{ base: "32px", md: "46px" }}
              lineHeight="1.05"
              letterSpacing="-0.03em"
            >
              The product, with the safeties off.
            </Text>
          </GridItem>
          <GridItem>
            <Text
              fontSize={{ base: "15px", md: "16px" }}
              lineHeight="1.65"
              color={tokens.muted}
            >
              A fully-loaded demo with sample data from three partner programmes — no
              login, no sign-up. Walk through the dashboard, the AR scanner, and the
              forecasting engine in one session.
            </Text>
          </GridItem>
        </Grid>

        {/* Demo "window" */}
        <Box
          border={`1px solid ${tokens.rule}`}
          borderRadius="10px"
          overflow="hidden"
          bg="#fff"
          boxShadow="0 24px 60px rgba(14,17,22,0.08)"
        >
          {/* window chrome */}
          <Flex
            alignItems="center"
            gap="14px"
            padding="12px 18px"
            bg="#fafbfd"
            borderBottom={`1px solid ${tokens.rule}`}
          >
            <Flex gap="6px">
              <Box w="12px" h="12px" borderRadius="999px" bg="#ff5f57" />
              <Box w="12px" h="12px" borderRadius="999px" bg="#ffbd2e" />
              <Box w="12px" h="12px" borderRadius="999px" bg="#28c840" />
            </Flex>
            <Box
              flex="1"
              textAlign="center"
              className="vax-mono"
              fontSize="11px"
              color={tokens.muted}
              letterSpacing="0.06em"
            >
              app.vaxaivision.com / overview
            </Box>
            <Box
              className="vax-mono"
              fontSize="10px"
              padding="3px 8px"
              border={`1px solid ${tokens.brand}`}
              color={tokens.brand}
              borderRadius="3px"
              letterSpacing="0.08em"
            >
              ● DEMO MODE
            </Box>
          </Flex>

          <Grid
            templateColumns={{ base: "1fr", md: "220px 1fr" }}
            minH="440px"
          >
            {/* sidebar */}
            <Box
              bg="#fafbfd"
              borderRight={`1px solid ${tokens.rule}`}
              padding="20px 18px"
              display={{ base: "none", md: "block" }}
            >
              <Text
                className="vax-mono"
                fontSize="10px"
                letterSpacing="0.18em"
                textTransform="uppercase"
                color={tokens.muted}
                mb="12px"
              >
                Programme
              </Text>
              {sidebarItems.map((n, i) => (
                <Box
                  key={n}
                  padding="9px 12px"
                  borderRadius="6px"
                  mb="2px"
                  bg={i === 0 ? tokens.brandSoft : "transparent"}
                  color={i === 0 ? tokens.brand : tokens.ink}
                  fontSize="13px"
                  fontWeight={i === 0 ? 600 : 500}
                >
                  {n}
                </Box>
              ))}
            </Box>

            <Box padding="24px 28px">
              <Flex justifyContent="space-between" alignItems="baseline" mb="20px">
                <Text fontWeight={600} fontSize="20px" letterSpacing="-0.015em">
                  Programme overview
                </Text>
                <Flex gap="8px">
                  <Box
                    padding="5px 10px"
                    border={`1px solid ${tokens.rule}`}
                    borderRadius="4px"
                    fontSize="11px"
                    color={tokens.muted}
                    className="vax-mono"
                  >
                    All countries ▾
                  </Box>
                  <Box
                    padding="5px 10px"
                    border={`1px solid ${tokens.rule}`}
                    borderRadius="4px"
                    fontSize="11px"
                    color={tokens.muted}
                    className="vax-mono"
                  >
                    Last 30d ▾
                  </Box>
                </Flex>
              </Flex>

              <Grid templateColumns="repeat(4, 1fr)" gap="14px" mb="20px">
                {kpis.map(([l, v, d, c]) => (
                  <GridItem
                    key={l}
                    padding="14px 16px"
                    border={`1px solid ${tokens.rule}`}
                    borderRadius="6px"
                  >
                    <Text
                      fontSize="10px"
                      color={tokens.muted}
                      letterSpacing="0.1em"
                      textTransform="uppercase"
                      mb="6px"
                    >
                      {l}
                    </Text>
                    <Text
                      fontWeight={600}
                      fontSize="22px"
                      letterSpacing="-0.02em"
                      className="vax-tabular"
                    >
                      {v}
                    </Text>
                    <Text fontSize="11px" mt="2px" color={c}>
                      {d}
                    </Text>
                  </GridItem>
                ))}
              </Grid>

              <Box border={`1px solid ${tokens.rule}`} borderRadius="6px" padding="16px">
                <Flex justifyContent="space-between" mb="10px">
                  <Text fontSize="12px" fontWeight={600}>
                    Stockout risk · 12-week forecast
                  </Text>
                  <Text
                    fontSize="10px"
                    color={tokens.muted}
                    className="vax-mono"
                    letterSpacing="0.1em"
                  >
                    PROPHET + LIGHTGBM
                  </Text>
                </Flex>
                <svg viewBox="0 0 600 180" style={{ width: "100%", height: 180, display: "block" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <line
                      key={i}
                      x1="30"
                      x2="600"
                      y1={30 + i * 40}
                      y2={30 + i * 40}
                      stroke={tokens.rule}
                    />
                  ))}
                  {Array.from({ length: 16 }).map((_, i) => (
                    <rect
                      key={i}
                      x={36 + i * 22}
                      y={170 - (40 + Math.sin(i * 0.6) * 22)}
                      width="14"
                      height={40 + Math.sin(i * 0.6) * 22}
                      fill={`${tokens.ink}15`}
                    />
                  ))}
                  <polygon
                    points="40,120 80,116 120,112 160,104 200,96 240,86 280,76 320,64 360,52 400,44 440,38 480,32 520,28 520,72 480,76 440,82 400,90 360,100 320,114 280,128 240,138 200,148 160,152 120,156 80,158 40,158"
                    fill={`${tokens.brand}28`}
                  />
                  <polyline
                    fill="none"
                    stroke={tokens.brand}
                    strokeWidth="2.2"
                    points="40,140 80,130 120,118 160,108 200,96 240,82 280,68 320,56 360,46 400,38 440,32 480,28 520,24"
                  />
                  <line
                    x1="280"
                    x2="280"
                    y1="20"
                    y2="170"
                    stroke={tokens.muted}
                    strokeDasharray="3 4"
                  />
                  <text
                    x="284"
                    y="30"
                    fontSize="10"
                    fill={tokens.muted}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    FORECAST →
                  </text>
                </svg>
              </Box>
            </Box>
          </Grid>
        </Box>

        <Center mt="32px" gap="14px" flexWrap="wrap">
          <CTA variant="brand" size="lg" href="/demo">
            ▶ Launch live demo
          </CTA>
          <CTA variant="ghost" size="lg" href="/demo">
            Watch 90-sec tour
          </CTA>
        </Center>
      </Container>
    </Box>
  );
};

export default DemoEmbed;
