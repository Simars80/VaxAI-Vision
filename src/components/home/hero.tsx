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
      bg="#ffffff"
      position="relative"
      zIndex={5}
      overflow="hidden"
    >

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
                  bg="rgba(58,91,204,0.08)"
                  color="#3A5BCC"
                  border="1px solid rgba(58,91,204,0.2)"
                  textTransform="none"
                  letterSpacing="0.02em"
                >
                  🌍 AI-Powered Vaccine Supply Chain Intelligence
                </Badge>
              </Fade>

              <Text
                color="#1A1A1A"
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
                color="#667085"
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
                      color="#1A1A1A"
                      fontSize={{ base: "20px", md: "24px" }}
                      fontWeight={700}
                    >
                      {s.value}
                    </Text>
                    <Text color="#667085" fontSize="12px">
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
                    boxShadow="0 4px 15px rgba(58,91,204,0.25)"
                  >
                    Explore Solutions
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button
                    bg="transparent"
                    color="#1A1A1A"
                    h={{ base: "46px", md: "54px" }}
                    px={{ base: "20px", md: "28px" }}
                    borderRadius="10px"
                    fontSize={{ base: "13px", md: "15px" }}
                    fontWeight={600}
                    border="1px solid #DEE5ED"
                    _hover={{
                      bg: "#F8FAFC",
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
                border="1px solid #DEE5ED"
                boxShadow="0 20px 50px rgba(0,0,0,0.08)"
              >
                <DashboardPreview />
              </Box>
              <Text
                textAlign="center"
                mt="14px"
                color="#667085"
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
