"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

const problems = [
  {
    n: "01",
    label: "Unseen",
    title: "Stockouts kill immunisation campaigns",
    body: "Up to 50% of vaccine stockouts in sub-Saharan Africa go undetected for weeks. By the time a facility runs out, thousands of children have missed scheduled doses.",
  },
  {
    n: "02",
    label: "Wasted",
    title: "$1.4B in vaccines wasted annually",
    body: "Without real-time visibility, facilities over-order to avoid stockouts — leading to expiry-driven waste that costs health systems billions each year.",
  },
  {
    n: "03",
    label: "Invisible",
    title: "Cold-chain blind spots",
    body: "Most facilities track inventory on paper or in siloed Excel sheets. Temperature excursions and phantom stock remain invisible until it's too late.",
  },
];

const ProblemStatement = () => {
  return (
    <Box bg={tokens.bg} py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Box mb={{ base: "40px", md: "56px" }} maxW="780px">
          <Eyebrow color={tokens.alert}>The problem we solve</Eyebrow>
          <Text as="h2" mt="14px" fontWeight={600}
                fontSize={{ base: "30px", md: "44px" }}
                lineHeight="1.05" letterSpacing="-0.03em" sx={{ textWrap: "balance" }}>
            Africa&apos;s cold chain crisis costs lives — and it&apos;s preventable.
          </Text>
        </Box>

        <Box borderTop={`1px solid ${tokens.rule}`}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="0">
            {problems.map((p, i, arr) => (
              <GridItem key={p.n}
                bg="#fff"
                padding={{ base: "32px 24px", md: "40px 32px" }}
                borderRight={{ base: "none", md: i === arr.length - 1 ? "none" : `1px solid ${tokens.rule}` }}
                borderBottom={`1px solid ${tokens.rule}`}>
                <Box mb="20px" display="flex" gap="14px" alignItems="baseline">
                  <Text className="vax-mono" fontSize="11px" color={tokens.alert} letterSpacing="0.14em">{p.n}</Text>
                  <Text className="vax-mono" fontSize="10px" color={tokens.muted} letterSpacing="0.18em" textTransform="uppercase">
                    {p.label}
                  </Text>
                </Box>
                <Text fontWeight={600} fontSize={{ base: "20px", md: "22px" }} letterSpacing="-0.015em" mb="12px">
                  {p.title}
                </Text>
                <Text fontSize="14.5px" lineHeight="1.65" color={tokens.muted}>
                  {p.body}
                </Text>
              </GridItem>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default ProblemStatement;
