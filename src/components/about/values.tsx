"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { values } from "@/utils/enums";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

const ValuesComponent = () => {
  return (
    <Box bg={tokens.bg} py={{ base: "64px", md: "110px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1.5fr" }}
          gap={{ base: "32px", md: "80px" }}
          alignItems="start"
          mb="48px"
        >
          <GridItem>
            <Eyebrow>What we hold</Eyebrow>
            <Text
              as="h2"
              mt="14px"
              fontWeight={600}
              fontSize={{ base: "32px", md: "44px" }}
              lineHeight="1.05"
              letterSpacing="-0.03em"
            >
              Core values.
            </Text>
          </GridItem>
          <GridItem alignSelf="end">
            <Text fontSize="15px" lineHeight="1.65" color={tokens.muted}>
              Four ideas we keep returning to when we build, hire, and decide what not to do.
            </Text>
          </GridItem>
        </Grid>

        <Box borderTop={`1px solid ${tokens.rule}`}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="0">
            {values.map((v: { title: string; sub: string }, i: number) => (
              <GridItem
                key={i}
                bg="#fff"
                padding={{ base: "28px 24px", md: "40px 36px" }}
                borderRight={{
                  base: "none",
                  md: i % 2 === 0 ? `1px solid ${tokens.rule}` : "none",
                }}
                borderBottom={`1px solid ${tokens.rule}`}
              >
                <Text
                  className="vax-mono"
                  fontSize="11px"
                  color={tokens.brand}
                  letterSpacing="0.14em"
                  mb="20px"
                >
                  {String(i + 1).padStart(2, "0")}
                </Text>
                <Text
                  fontWeight={600}
                  fontSize={{ base: "22px", md: "26px" }}
                  letterSpacing="-0.02em"
                  mb="14px"
                >
                  {v.title}
                </Text>
                <Text fontSize="15px" lineHeight="1.65" color={tokens.muted}>
                  {v.sub}
                </Text>
              </GridItem>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default ValuesComponent;
