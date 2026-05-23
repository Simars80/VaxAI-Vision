"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";
import { Eyebrow } from "./_atoms";

const quotes = [
  {
    q: "For the first time, I know what is in our cold box before I open it.",
    name: "A. Okafor",
    role: "Senior health worker, Kano State",
  },
  {
    q: "Forecasts that finally match what we see in the field. Our wastage dropped twelve points in the first quarter.",
    name: "Dr. M. Wanjiru",
    role: "Programme lead, Nairobi",
  },
  {
    q: "The DHIS2 sync was live in a day. We spent the rest of the pilot actually using the data.",
    name: "S. Nkosi",
    role: "M&E, regional ministry of health",
  },
];

const Testimonials = () => {
  return (
    <Box
      bg="#fafbfd"
      py={{ base: "64px", md: "110px" }}
      borderTop={`1px solid ${tokens.rule}`}
    >
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Eyebrow>Field voices</Eyebrow>
        <Text
          as="h2"
          mt="14px"
          mb="48px"
          fontWeight={600}
          fontSize={{ base: "32px", md: "44px" }}
          lineHeight="1.05"
          letterSpacing="-0.03em"
          maxW="700px"
        >
          From the people who carry the boxes.
        </Text>

        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="20px">
          {quotes.map((qt, i) => (
            <GridItem
              key={i}
              bg="#fff"
              border={`1px solid ${tokens.rule}`}
              padding="28px 28px 24px"
              borderRadius="8px"
              display="flex"
              flexDir="column"
            >
              <Text
                className="vax-serif"
                fontSize="42px"
                color={tokens.brand}
                lineHeight="0.6"
                mb="8px"
                sx={{ height: "24px" }}
              >
                &ldquo;
              </Text>
              <Text fontSize="16px" lineHeight="1.6" color={tokens.ink} flex="1">
                {qt.q}
              </Text>
              <Box mt="24px" pt="16px" borderTop={`1px solid ${tokens.rule}`}>
                <Text fontSize="13px" fontWeight={600}>
                  {qt.name}
                </Text>
                <Text fontSize="12px" color={tokens.muted} mt="2px">
                  {qt.role}
                </Text>
              </Box>
            </GridItem>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Testimonials;
