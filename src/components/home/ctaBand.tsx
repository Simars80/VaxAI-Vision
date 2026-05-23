"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { tokens } from "./_tokens";
import { Eyebrow, CTA } from "./_atoms";

const CtaBand = () => {
  return (
    <Box bg={tokens.bg} py={{ base: "64px", md: "110px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Box
          bg={tokens.ink}
          color="#fff"
          padding={{ base: "40px 28px", md: "72px 64px" }}
          borderRadius="12px"
          position="relative"
          overflow="hidden"
        >
          {/* faint grid */}
          <Box
            position="absolute"
            sx={{
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              pointerEvents: "none",
            }}
          />
          <Grid
            templateColumns={{ base: "1fr", md: "1.5fr 1fr" }}
            gap="40px"
            alignItems="end"
            sx={{ position: "relative" }}
          >
            <GridItem>
              <Eyebrow color="#9aa6cf">Ready when you are</Eyebrow>
              <Text
                as="h2"
                mt="14px"
                fontWeight={600}
                fontSize={{ base: "36px", md: "56px" }}
                lineHeight="1.0"
                letterSpacing="-0.03em"
              >
                Bring VaxAI Vision
                <br />
                to your programme.
              </Text>
            </GridItem>
            <GridItem>
              <Text fontSize="15px" lineHeight="1.6" color="rgba(255,255,255,0.7)" mb="20px">
                Most pilots start with 5–10 facilities and 90 days. Tell us what you&apos;re
                trying to fix — we&apos;ll come back with a proposed scope within a week.
              </Text>
              <Flex gap="12px" flexWrap="wrap">
                <CTA variant="brand" size="lg" href="/waitlist">
                  Request access →
                </CTA>
                <Link
                  href="/contact"
                  style={{
                    padding: "15px 26px",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 500,
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Talk to the team
                </Link>
              </Flex>
            </GridItem>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default CtaBand;
