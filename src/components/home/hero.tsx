"use client";

import {
  Box,
  Button,
  Container,
  Grid,
  GridItem,
  Text,
  Badge,
} from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { Slide, Fade } from "react-awesome-reveal";
import DashboardPreview from "./DashboardPreview";

const Hero = () => {
  return (
    <Box
      bg="linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
      position="relative"
      zIndex={5}
      overflow="hidden"
    >
      {/* Subtle grid background */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.04}
        backgroundImage="linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)"
        backgroundSize="40px 40px"
        pointerEvents="none"
      />

      {/* Glow accents */}
      <Box
        position="absolute"
        top="-100px"
        left="-100px"
        w="400px"
        h="400px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(58,91,204,0.15) 0%, transparent 70%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-80px"
        right="-80px"
        w="350px"
        h="350px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)"
        pointerEvents="none"
      />

      <Container maxW="container.xl" py={{ base: "60px", md: "100px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={{ base: "48px", md: "64px" }}
          alignItems="center"
        >
          {/* Left — copy */}
          <GridItem>
            <Slide direction="left" triggerOnce>
              <Fade triggerOnce>
                <Badge
                  colorScheme="blue"
                  fontSize="12px"
                  px="12px"
                  py="5px"
                  borderRadius="full"
                  mb="20px"
                  bg="rgba(58,91,204,0.15)"
                  color="#93C5FD"
                  border="1px solid rgba(58,91,204,0.3)"
                  textTransform="none"
                  letterSpacing="0.02em"
                >
                  🌍 AI-Powered Vaccine Supply Chain Intelligence
                </Badge>
              </Fade>

              <Text
                color="#F1F5F9"
                fontSize={{ base: "30px", md: "52px" }}
                fontWeight={800}
                lineHeight={1.15}
                mb="20px"
                letterSpacing="-0.02em"
              >
                Redefining{" "}
                <Box as="span" color="#3A5BCC">
                  Vaccine
                </Box>{" "}
                Management
              </Text>

              <Text
                fontSize={{ base: "15px", md: "17px" }}
                fontWeight={400}
                color="#94A3B8"
                lineHeight={1.7}
                mb="36px"
                maxW="480px"
              >
                Real-time inventory tracking, AI-driven forecasting, and cold
                chain monitoring — built for healthcare systems across Africa
                and beyond.
              </Text>

              {/* Stats row */}
              <Box
                display="flex"
                gap={{ base: "20px", md: "32px" }}
                mb="40px"
                flexWrap="wrap"
              >
                {[
                  { value: "2.4M+", label: "Doses tracked" },
                  { value: "1,240", label: "Facilities" },
                  { value: "98.7%", label: "Cold chain uptime" },
                ].map((s) => (
                  <Box key={s.label}>
                    <Text
                      color="#F1F5F9"
                      fontSize={{ base: "20px", md: "24px" }}
                      fontWeight={700}
                    >
                      {s.value}
                    </Text>
                    <Text color="#64748B" fontSize="12px">
                      {s.label}
                    </Text>
                  </Box>
                ))}
              </Box>

              <Box display="flex" gap="14px" flexWrap="wrap">
                <Link href="#solutions">
                  <Button
                    bg="#3A5BCC"
                    color="#fff"
                    h={{ base: "46px", md: "54px" }}
                    px={{ base: "20px", md: "28px" }}
                    borderRadius="10px"
                    fontSize={{ base: "13px", md: "15px" }}
                    fontWeight={600}
                    _hover={{ bg: "#2D4BAF", transform: "translateY(-1px)" }}
                    transition="all 0.2s"
                    boxShadow="0 4px 15px rgba(58,91,204,0.4)"
                  >
                    Explore Solutions
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button
                    bg="rgba(255,255,255,0.05)"
                    color="#F1F5F9"
                    h={{ base: "46px", md: "54px" }}
                    px={{ base: "20px", md: "28px" }}
                    borderRadius="10px"
                    fontSize={{ base: "13px", md: "15px" }}
                    fontWeight={600}
                    border="1px solid rgba(255,255,255,0.12)"
                    _hover={{
                      bg: "rgba(255,255,255,0.1)",
                      transform: "translateY(-1px)",
                    }}
                    transition="all 0.2s"
                  >
                    ▶ Try Live Demo
                  </Button>
                </Link>
              </Box>
            </Slide>
          </GridItem>

          {/* Right — animated dashboard preview */}
          <GridItem display={{ base: "none", md: "block" }}>
            <Slide direction="right" triggerOnce>
              <Box
                h="420px"
                borderRadius="16px"
                overflow="hidden"
                boxShadow="0 30px 60px rgba(0,0,0,0.5)"
              >
                <DashboardPreview />
              </Box>
              <Text
                textAlign="center"
                mt="14px"
                color="#64748B"
                fontSize="13px"
                letterSpacing="0.01em"
              >
                ↓ Live demo below
              </Text>
            </Slide>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default Hero;
