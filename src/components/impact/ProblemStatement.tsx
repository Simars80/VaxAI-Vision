"use client";

import { Box, Container, Grid, GridItem, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { Fade, Slide } from "react-awesome-reveal";
import { FiAlertTriangle, FiTrendingDown, FiThermometer } from "react-icons/fi";

const problems = [
  {
    icon: FiAlertTriangle,
    color: "#F56630",
    title: "Stockouts kill immunisation campaigns",
    body: "Up to 50% of vaccine stockouts in sub-Saharan Africa go undetected for weeks. By the time a facility runs out, thousands of children have missed scheduled doses.",
  },
  {
    icon: FiTrendingDown,
    color: "#E53E3E",
    title: "$1.4B in vaccines wasted annually",
    body: "Without real-time visibility, facilities over-order to avoid stockouts — leading to expiry-driven waste that costs health systems billions each year.",
  },
  {
    icon: FiThermometer,
    color: "#3A5BCC",
    title: "Cold-chain blind spots",
    body: "Most facilities track inventory on paper or in siloed Excel sheets. Temperature excursions and phantom stock remain invisible until it's too late.",
  },
];

const ProblemStatement = () => {
  return (
    <Box bg="#FBFBFB" py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl">
        <Slide direction="up" triggerOnce>
          <VStack spacing={4} mb={{ base: "48px", md: "72px" }} align="center" textAlign="center">
            <Text
              color="#E53E3E"
              fontSize="14px"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing="2px"
            >
              The Problem We Solve
            </Text>
            <Text
              color="#1A1A1A"
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight={800}
              maxW="750px"
              lineHeight="1.2"
            >
              Africa's cold chain crisis costs lives — and it's preventable
            </Text>
          </VStack>
        </Slide>

        <Grid
          templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap={{ base: "24px", md: "32px" }}
        >
          {problems.map((p, idx) => (
            <Fade key={idx} triggerOnce delay={idx * 150}>
              <Box
                bg="#fff"
                borderRadius="16px"
                p={{ base: "28px", md: "36px" }}
                border="1px solid #E8E8E8"
                h="full"
                _hover={{
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  transform: "translateY(-4px)",
                  transition: "all 0.3s",
                }}
                transition="all 0.3s"
              >
                <Box
                  w="52px"
                  h="52px"
                  bg={`${p.color}15`}
                  borderRadius="12px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  mb="20px"
                >
                  <p.icon size={24} color={p.color} />
                </Box>
                <Text
                  color="#1A1A1A"
                  fontSize={{ base: "18px", md: "20px" }}
                  fontWeight={700}
                  mb="12px"
                >
                  {p.title}
                </Text>
                <Text color="#667085" fontSize="15px" lineHeight="1.7">
                  {p.body}
                </Text>
              </Box>
            </Fade>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ProblemStatement;
