"use client";

import {
  Box,
  Button,
  Center,
  Container,
  Grid,
  GridItem,
  Text,
} from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";

const Solutions = () => {
  /* Unified solution cards — core platform capabilities + live features */
  const platformCards = [
    {
      title: "Real-Time Inventory Dashboard",
      emoji: "📦",
      sub: "Monitor stock levels across every facility — colour-coded as adequate, low, or critical. Filter by vaccine type, country, or facility to spot shortfalls before they become stockouts.",
      href: "/demo",
      cta: "Explore Inventory",
    },
    {
      title: "AI-Powered Forecasting",
      emoji: "📊",
      sub: "Predict demand surges, flag expiring stock, and model what-if scenarios so you can order the right quantity at the right time — reducing waste and preventing shortages.",
      href: "/demo?tab=forecasting",
      cta: "View Forecasts",
    },
    {
      title: "Cold Chain Monitor",
      emoji: "❄️",
      sub: "Live temperature readings from cold storage units with configurable alert thresholds, breach event timeline, and min/max trend charts. Keep every vial safe from factory to clinic.",
      href: "/demo",
      cta: "See Cold Chain Data",
    },
    {
      title: "Geospatial Coverage Map",
      emoji: "🗺️",
      sub: "Interactive map showing immunisation coverage rates and stock status per facility — from Kano to Kisumu. Filter by country, vaccine type, and time period.",
      href: "/demo",
      cta: "View Coverage Map",
    },
    {
      title: "AR Stock Counter",
      emoji: "📷",
      sub: "Point your camera at vaccine storage shelves and let AI count and classify every item in real time. Compare AR-scanned counts against system inventory for instant reconciliation.",
      href: "/demo?tab=ar-scanner",
      cta: "Try AR Scanner",
    },
    {
      title: "Computer Vision Analytics",
      emoji: "🤖",
      sub: "AI models trained on vaccine packaging detect, classify, and count stock automatically — powering both the AR scanner and batch image analysis for large-scale audits.",
      href: "/demo?tab=vision",
      cta: "Explore Vision AI",
    },
  ];

  return (
    <Box mt="80px" mb={{ base: "40px", md: "100px" }} id="solutions">
      <Container maxW={"container.xl"}>
        <Center flexDir="column">
          <Text
            textAlign={"center"}
            w={{ base: "auto", md: "746px" }}
            fontSize={{ base: "18px", md: "42px" }}
            fontWeight={700}
            color="#1A1A1A"
          >
            Our Solutions
          </Text>
          <Text
            textAlign="center"
            mt="12px"
            color="#667085"
            fontSize={{ base: "14px", md: "16px" }}
            maxW="600px"
          >
            An end-to-end platform for vaccine supply chain intelligence — from cold
            storage to last-mile delivery.
          </Text>
        </Center>

        {/* Platform capability cards */}
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }}
          gap={{ base: "20px", md: "28px" }}
          mt="40px"
        >
          <Slide direction="up" damping={0.1} cascade triggerOnce>
            {platformCards.map((card, idx) => (
              <GridItem key={idx}>
                <Box
                  p="28px"
                  borderRadius={"12px"}
                  border="1px solid #DEE5ED"
                  bg="#fff"
                  h="full"
                  display="flex"
                  flexDir="column"
                  transition="all 0.2s"
                  _hover={{
                    borderColor: "#3A5BCC",
                    boxShadow: "0 4px 20px rgba(58,91,204,0.08)",
                    transform: "translateY(-2px)",
                  }}
                >
                  <Text fontSize="36px" mb="4px">{card.emoji}</Text>
                  <Text
                    mt="12px"
                    mb="10px"
                    color="#1A1A1A"
                    fontSize={"16px"}
                    fontWeight={700}
                  >
                    {card.title}
                  </Text>
                  <Text color="#667085" fontSize={"13px"} fontWeight={400} lineHeight={1.6} flex="1">
                    {card.sub}
                  </Text>
                  <Link href={card.href}>
                    <Button
                      bg="#3A5BCC"
                      h="46px"
                      borderRadius={"10px"}
                      mt="24px"
                      color="#fff"
                      fontSize={"14px"}
                      fontWeight={500}
                      _hover={{ opacity: 0.85 }}
                    >
                      {card.cta}
                    </Button>
                  </Link>
                </Box>
              </GridItem>
            ))}
          </Slide>
        </Grid>

        {/* Deep-dive solutions link */}
        <Center mt={{ base: "32px", md: "48px" }} flexDir="column" gap="12px">
          <Text color="#667085" fontSize="14px">
            Want to learn more about the technology behind these features?
          </Text>
          <Link href="/solutions">
            <Button
              bg="transparent"
              h="50px"
              borderRadius={"10px"}
              color="#3A5BCC"
              fontSize={"15px"}
              fontWeight={600}
              border="1px solid #3A5BCC"
              _hover={{
                bg: "rgba(58,91,204,0.04)",
              }}
            >
              View All Solutions →
            </Button>
          </Link>
        </Center>
      </Container>
    </Box>
  );
};

export default Solutions;
