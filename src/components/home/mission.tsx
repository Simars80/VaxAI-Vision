"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { tokens } from "./_tokens";
import { Placeholder } from "./_atoms";

const Mission = () => {
  return (
    <Box
      id="about"
      bg={tokens.paper}
      color={tokens.paperInk}
      py={{ base: "80px", md: "128px" }}
    >
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        {/* masthead-style rule */}
        <Flex alignItems="center" gap="14px" mb="14px">
          <Text
            className="vax-serif"
            fontWeight={700}
            fontSize="20px"
            letterSpacing="-0.02em"
          >
            VaxAI Vision · Field Dispatch
          </Text>
          <Box flex="1" h="1px" bg={tokens.paperRule} />
          <Text
            className="vax-mono"
            fontSize="10px"
            letterSpacing="0.2em"
            textTransform="uppercase"
            color="rgba(26,20,16,0.55)"
          >
            Issue 24 · May 2026
          </Text>
        </Flex>
        <Box h="1.5px" bg={tokens.paperInk} mb="44px" />

        <Grid
          templateColumns={{ base: "1fr", md: "1.35fr 1fr" }}
          gap={{ base: "40px", md: "64px" }}
          alignItems="start"
        >
          <GridItem>
            <Text
              fontSize="11px"
              letterSpacing="0.3em"
              textTransform="uppercase"
              color={tokens.paperBrick}
              mb="14px"
            >
              Why we exist
            </Text>
            <Text
              as="h2"
              className="vax-serif"
              fontWeight={500}
              fontSize={{ base: "40px", md: "72px" }}
              lineHeight="0.98"
              letterSpacing="-0.03em"
              sx={{ textWrap: "balance" }}
            >
              A vial leaves the factory.{" "}
              <Box
                as="em"
                fontStyle="italic"
                color={tokens.paperBrick}
                fontWeight={400}
              >
                Twenty-three days later,
              </Box>{" "}
              it must still be cold.
            </Text>
            <Text
              mt="22px"
              fontStyle="italic"
              fontSize="15px"
              lineHeight="1.55"
              color="rgba(26,20,16,0.6)"
              maxW="540px"
            >
              The story of last-mile immunisation is the story of the people who carry,
              count, and care for vials — and the systems that fail them.
            </Text>

            <Box
              mt="32px"
              sx={{
                columnCount: 1,
                columnGap: "32px",
                "@media (min-width: 768px)": { columnCount: 2 },
              }}
              fontSize="15.5px"
              lineHeight="1.65"
              maxW="700px"
            >
              <Text margin="0" sx={{ textWrap: "pretty" }}>
                <Box
                  as="span"
                  className="vax-serif"
                  sx={{
                    float: "left",
                    fontWeight: 700,
                    fontSize: "72px",
                    lineHeight: "0.85",
                    paddingRight: "10px",
                    paddingTop: "8px",
                    color: tokens.paperBrick,
                  }}
                >
                  V
                </Box>
                axAI Vision is the operating layer for the people who keep vaccines viable
                across the last mile — combining live computer vision, ensemble
                forecasting, and cold-chain telemetry behind a single, calm interface.
              </Text>
              <Text mt="14px" sx={{ textWrap: "pretty" }}>
                It is built for ministries, NGOs, and field supervisors who do not have
                time to learn another dashboard. It speaks DHIS2, mSupply, OpenLMIS, and
                FHIR — and works offline when the signal does not.
                <Box as="sup" color={tokens.paperBrick}>
                  1
                </Box>
              </Text>
              <Text mt="14px" sx={{ textWrap: "pretty" }}>
                Up to a quarter of vaccines lose potency before they reach a patient. Our
                job is to make that gap visible — and then close it, vial by vial.
              </Text>
            </Box>

            <Flex gap="14px" mt="36px" alignItems="center" flexWrap="wrap">
              <Box
                as="a"
                href="/about"
                padding="13px 22px"
                bg={tokens.paperInk}
                color={tokens.paper}
                fontWeight={500}
                fontSize="14px"
                letterSpacing="0.01em"
              >
                Read the platform brief →
              </Box>
              <Text fontSize="13px" fontStyle="italic" color="rgba(26,20,16,0.6)">
                or{" "}
                <Link
                  href="/waitlist"
                  className="vax-link"
                  style={{
                    color: tokens.paperBrick,
                    borderColor: tokens.paperBrick,
                  }}
                >
                  request a pilot →
                </Link>
              </Text>
            </Flex>
          </GridItem>

          {/* RIGHT — figure */}
          <GridItem alignSelf="start">
            <Placeholder w="100%" h="380px" color={tokens.paperInk}>
              Field photo · Cold box, Kisumu
            </Placeholder>
            <Box mt="14px" pt="12px" borderTop={`1px solid ${tokens.paperRule}`}>
              <Text
                fontSize="12px"
                fontStyle="italic"
                color="rgba(26,20,16,0.65)"
                lineHeight="1.55"
              >
                <Box as="strong" color={tokens.paperInk} fontStyle="normal">
                  Fig. 1 —
                </Box>{" "}
                A cold box arrives at a rural health post in Kisumu County. Without
                continuous monitoring, up to 25% of vaccines lose potency before they are
                administered.
              </Text>
            </Box>

            <Box
              mt="28px"
              padding="22px 24px"
              bg="rgba(26,20,16,0.04)"
              borderLeft={`3px solid ${tokens.paperBrick}`}
            >
              <Text
                className="vax-serif"
                fontSize="36px"
                fontWeight={700}
                lineHeight="1.0"
                letterSpacing="-0.02em"
              >
                2.4M doses
              </Text>
              <Text mt="8px" fontSize="13px" color="rgba(26,20,16,0.65)" lineHeight="1.5">
                kept viable across the last mile since the platform first deployed in
                partner facilities in 2023.
              </Text>
            </Box>
          </GridItem>
        </Grid>

        <Box mt="64px" pt="16px" borderTop={`1px solid ${tokens.paperRule}`}>
          <Text
            fontSize="11px"
            color="rgba(26,20,16,0.55)"
            letterSpacing="0.02em"
          >
            <Box as="sup" color={tokens.paperBrick}>
              1
            </Box>
            &nbsp;&nbsp;See{" "}
            <Link
              href="/solutions"
              className="vax-link"
              style={{ color: tokens.paperInk, borderColor: tokens.paperRule }}
            >
              docs / integrations
            </Link>{" "}
            for the full list of supported standards and offline-sync behaviour.
          </Text>
        </Box>
      </Container>
    </Box>
  );
};

export default Mission;
