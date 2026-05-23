"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { Slide, Fade } from "react-awesome-reveal";
import { tokens } from "./_tokens";
import { Eyebrow, CTA } from "./_atoms";

const Hero = () => {
  return (
    <Box bg={tokens.bg} pt={{ base: "32px", md: "64px" }} pb={{ base: "64px", md: "88px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1.05fr 1fr" }}
          gap={{ base: "48px", md: "72px" }}
          alignItems="start"
        >
          {/* LEFT — copy */}
          <GridItem>
            <Slide direction="left" triggerOnce>
              <Fade triggerOnce>
                <Eyebrow>Platform v3 · Now in field trial</Eyebrow>
              </Fade>

              <Text
                as="h1"
                mt="22px"
                fontWeight={600}
                fontSize={{ base: "40px", md: "68px" }}
                lineHeight="1.02"
                letterSpacing="-0.035em"
                color={tokens.ink}
              >
                Precision for the
                <br />
                last{" "}
                <Box as="span" color={tokens.brand}>
                  cold mile
                </Box>
                .
              </Text>

              <Text
                mt="22px"
                fontSize={{ base: "15px", md: "17px" }}
                lineHeight="1.6"
                color={tokens.muted}
                maxW="500px"
              >
                Computer vision, demand forecasting, and cold-chain telemetry — engineered for
                health supply chain teams operating without margin for error. Built for the
                field, integrated with the systems you already run.
              </Text>

              <Flex gap="12px" mt="32px" flexWrap="wrap">
                <CTA variant="brand" size="lg" href="#request">
                  Request access →
                </CTA>
                <CTA variant="ghost" size="lg" href="#demo">
                  ▶ See the platform
                </CTA>
              </Flex>

              {/* hairline stat strip */}
              <Box mt="56px" pt="22px" borderTop={`1px solid ${tokens.rule}`}>
                <Grid templateColumns="repeat(4, 1fr)" gap="0">
                  {([
                    ["2.41M", "Doses tracked"],
                    ["1,240", "Facilities"],
                    ["98.7%", "Chain uptime"],
                    ["11", "Countries live"],
                  ] as const).map(([v, l], i) => (
                    <GridItem
                      key={l}
                      pl={i ? "18px" : "0"}
                      borderLeft={i ? `1px solid ${tokens.rule}` : "none"}
                    >
                      <Text
                        fontWeight={600}
                        fontSize={{ base: "20px", md: "26px" }}
                        letterSpacing="-0.02em"
                        className="vax-tabular"
                      >
                        {v}
                      </Text>
                      <Text
                        mt="4px"
                        fontSize="11px"
                        color={tokens.muted}
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                      >
                        {l}
                      </Text>
                    </GridItem>
                  ))}
                </Grid>
              </Box>
            </Slide>
          </GridItem>

          {/* RIGHT — instrument card */}
          <GridItem display={{ base: "none", md: "block" }}>
            <Slide direction="right" triggerOnce>
              <Box
                border={`1px solid ${tokens.rule}`}
                borderRadius="8px"
                padding="22px 24px"
                bg="#fff"
              >
                <Flex alignItems="flex-start" justifyContent="space-between" mb="20px">
                  <Box>
                    <Text
                      fontSize="10px"
                      letterSpacing="0.2em"
                      textTransform="uppercase"
                      color={tokens.muted}
                    >
                      VVM Scanner · live
                    </Text>
                    <Text fontWeight={600} fontSize="17px" mt="6px">
                      Kano State warehouse W-03
                    </Text>
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
                    ● ONLINE
                  </Box>
                </Flex>

                {/* vial grid */}
                <Grid templateColumns="repeat(10, 1fr)" gap="5px" mb="16px">
                  {Array.from({ length: 40 }).map((_, i) => {
                    const stage = i === 17 ? 3 : i % 13 === 4 || i % 11 === 7 ? 2 : 1;
                    const c = stage === 1 ? tokens.brand : stage === 2 ? tokens.watch : tokens.alert;
                    const bgC =
                      stage === 1 ? `${tokens.brand}14` : stage === 2 ? `${tokens.watch}1d` : `${tokens.alert}1d`;
                    return (
                      <Box
                        key={i}
                        sx={{ aspectRatio: "1" }}
                        borderRadius="2px"
                        bg={bgC}
                        border={`1px solid ${c}55`}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Box w="6px" h="6px" borderRadius="999px" bg={c} />
                      </Box>
                    );
                  })}
                </Grid>

                <Grid
                  templateColumns="repeat(3, 1fr)"
                  gap="0"
                  pt="14px"
                  borderTop={`1px solid ${tokens.rule}`}
                >
                  <GridItem>
                    <Text fontSize="11px" color={tokens.muted} mb="4px">
                      Safe · Stage 1
                    </Text>
                    <Text fontWeight={600} fontSize="14px" color={tokens.brand}>
                      34 vials
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="11px" color={tokens.muted} mb="4px">
                      Watch · Stage 2
                    </Text>
                    <Text fontWeight={600} fontSize="14px" color="#9c7a1f">
                      05 vials
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="11px" color={tokens.muted} mb="4px">
                      Discard · Stage 3+
                    </Text>
                    <Text fontWeight={600} fontSize="14px" color={tokens.alert}>
                      01 vial
                    </Text>
                  </GridItem>
                </Grid>

                <Box mt="18px" pt="14px" borderTop={`1px solid ${tokens.rule}`}>
                  <Text
                    fontSize="11px"
                    color={tokens.muted}
                    mb="6px"
                    className="vax-mono"
                  >
                    SCAN HISTORY · LAST 4 H
                  </Text>
                  <svg viewBox="0 0 320 56" style={{ width: "100%", height: 56 }}>
                    {Array.from({ length: 24 }).map((_, i) => {
                      const v = 18 + Math.sin(i * 0.7) * 12 + (i === 17 ? -10 : 0);
                      return (
                        <rect
                          key={i}
                          x={i * 13 + 2}
                          y={56 - v}
                          width="10"
                          height={v}
                          fill={i === 17 ? tokens.alert : tokens.brand}
                          opacity="0.85"
                          rx="1"
                        />
                      );
                    })}
                  </svg>
                </Box>
              </Box>

              <Text
                mt="14px"
                textAlign="center"
                fontSize="12px"
                color={tokens.muted}
              >
                Live VVM scanner readout from a partner facility. ↓ Scroll for more.
              </Text>
            </Slide>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default Hero;
