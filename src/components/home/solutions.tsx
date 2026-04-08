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
import React, { useEffect } from "react";
import { solutions } from "@/utils/enums";
import Image from "next/image";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";

const Solutions = () => {
  return (
    <Box mt="80px" mb={{ base: "40px", md: "100px" }} id="solutions">
      <Container maxW={"container.xl"}>
        <Center>
          <Text
            textAlign={"center"}
            w={{ base: "auto", md: "746px" }}
            fontSize={{ base: "18px", md: "42px" }}
            fontWeight={700}
            color="#1A1A1A"
          >
            Our Solutions
          </Text>
        </Center>

        <Grid
          templateColumns={{ base: "auto", md: "repeat(3,1fr)" }}
          gap={{ base: "24px", md: "45px" }}
          mt="31px"
        >
          <Slide direction="up" damping={0.1} cascade triggerOnce>
            {solutions.slice(0, 3).map((data: any, idx: number) => (
              <GridItem key={idx}>
                <Box
                  p="24px"
                  borderRadius={"10px"}
                  border="1px solid #DEE5ED"
                  bg="#fff"
                >
                  <Image
                    src={data?.icon}
                    alt={data?.title}
                    style={{ width: "40px", height: "40px" }}
                  />

                  <Text
                    mt="16px"
                    mb="10px"
                    color="#1A1A1A"
                    fontSize={"16px"}
                    fontWeight={700}
                  >
                    {data.title}
                  </Text>

                  <Text color="#667085" fontSize={"12px"} fontWeight={400}>
                    {data?.sub}
                  </Text>

                  <Link href={`/solutions/${data.slug}`}>
                    <Button
                      bg="#3A5BCC"
                      h="50px"
                      borderRadius={"10px"}
                      mt="32px"
                      color="#fff"
                      fontSize={"16px"}
                      fontWeight={400}
                      _hover={{
                        opacity: 0.8,
                      }}
                    >
                      Learn More
                    </Button>
                  </Link>
                </Box>
              </GridItem>
            ))}
          </Slide>
        </Grid>

        {/* Phase 2 Feature Cards */}
        <Text
          mt={{ base: "40px", md: "64px" }}
          mb="24px"
          textAlign="center"
          fontSize={{ base: "16px", md: "24px" }}
          fontWeight={700}
          color="#1A1A1A"
        >
          Phase 2 — Operational Intelligence
        </Text>
        <Grid
          templateColumns={{ base: "auto", md: "repeat(3,1fr)" }}
          gap={{ base: "24px", md: "45px" }}
        >
          <Slide direction="up" damping={0.1} cascade triggerOnce>
            {[
              {
                title: "Inventory Dashboard",
                emoji: "📦",
                sub: "Monitor real-time stock levels across every facility — colour-coded as adequate, low, or critical. Filter by vaccine type, country, or facility to spot shortfalls before they become stockouts.",
                href: "/demo",
                cta: "Explore Inventory",
              },
              {
                title: "Geospatial Coverage Map",
                emoji: "🗺️",
                sub: "Interactive Leaflet map showing immunisation coverage rates and stock status per facility — from Kano to Kisumu. Filter by country, vaccine type, and time period.",
                href: "/demo",
                cta: "View Coverage Map",
              },
              {
                title: "Cold Chain Monitor",
                emoji: "❄️",
                sub: "Live temperature readings from cold storage units with configurable alert thresholds, breach event timeline, and min/max trend charts. Keep every vial safe from factory to clinic.",
                href: "/demo",
                cta: "See Cold Chain Data",
              },
            ].map((card, idx) => (
              <GridItem key={idx}>
                <Box
                  p="24px"
                  borderRadius={"10px"}
                  border="1px solid #DEE5ED"
                  bg="#fff"
                  h="full"
                  display="flex"
                  flexDir="column"
                >
                  <Text fontSize="32px">{card.emoji}</Text>
                  <Text
                    mt="16px"
                    mb="10px"
                    color="#1A1A1A"
                    fontSize={"16px"}
                    fontWeight={700}
                  >
                    {card.title}
                  </Text>
                  <Text color="#667085" fontSize={"12px"} fontWeight={400} flex="1">
                    {card.sub}
                  </Text>
                  <Link href={card.href}>
                    <Button
                      bg="#3A5BCC"
                      h="50px"
                      borderRadius={"10px"}
                      mt="32px"
                      color="#fff"
                      fontSize={"15px"}
                      fontWeight={500}
                      _hover={{ opacity: 0.8 }}
                    >
                      {card.cta}
                    </Button>
                  </Link>
                </Box>
              </GridItem>
            ))}
          </Slide>
        </Grid>

        <Center>
          <Link href="/solutions">
            <Button
              bg="#3A5BCC"
              h="50px"
              borderRadius={"10px"}
              mt={{ base: "32px", md: "64px" }}
              color="#fff"
              fontSize={"16px"}
              fontWeight={400}
              _hover={{
                opacity: 0.8,
              }}
            >
              View more
            </Button>
          </Link>
        </Center>
      </Container>
    </Box>
  );
};

export default Solutions;
