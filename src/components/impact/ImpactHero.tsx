"use client";

import { Box, Button, Container, Text, VStack } from "@chakra-ui/react";
import React from "react";
import { Fade, Slide } from "react-awesome-reveal";
import Link from "next/link";

const ImpactHero = () => {
  return (
    <Box
      bg="#1A1A1A"
      py={{ base: "80px", md: "120px" }}
      position="relative"
      overflow="hidden"
    >
      {/* Background accent */}
      <Box
        position="absolute"
        top="-120px"
        right="-120px"
        w="500px"
        h="500px"
        borderRadius="full"
        bg="#3A5BCC"
        opacity={0.08}
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-80px"
        left="-80px"
        w="300px"
        h="300px"
        borderRadius="full"
        bg="#F56630"
        opacity={0.06}
        pointerEvents="none"
      />

      <Container maxW="container.xl">
        <VStack spacing={{ base: 6, md: 8 }} align="center" textAlign="center">
          <Fade triggerOnce>
            <Box
              bg="#3A5BCC22"
              border="1px solid #3A5BCC66"
              borderRadius="full"
              px="20px"
              py="8px"
            >
              <Text color="#3A5BCC" fontSize="14px" fontWeight={600}>
                GRANT &amp; DONOR BRIEF — 2025
              </Text>
            </Box>
          </Fade>

          <Slide direction="up" triggerOnce duration={800}>
            <Text
              color="#fff"
              fontSize={{ base: "32px", md: "64px" }}
              fontWeight={800}
              lineHeight={{ base: "1.2", md: "1.1" }}
              maxW="900px"
            >
              Ending Vaccine Stockouts{" "}
              <Text as="span" color="#F56630">
                Across Africa
              </Text>
            </Text>
          </Slide>

          <Slide direction="up" triggerOnce duration={1000}>
            <Text
              color="#A0AEC0"
              fontSize={{ base: "16px", md: "20px" }}
              fontWeight={400}
              maxW="700px"
              lineHeight="1.7"
            >
              VaxAI is an AI-powered platform that gives healthcare facilities
              real-time visibility into vaccine inventory — slashing stockouts,
              reducing waste, and helping governments deliver equitable
              immunisation at scale.
            </Text>
          </Slide>

          <Fade triggerOnce delay={400}>
            <Box display="flex" gap="16px" flexWrap="wrap" justifyContent="center">
              <a href="#ask">
                <Button
                  bg="#3A5BCC"
                  color="#fff"
                  h="55px"
                  px="32px"
                  borderRadius="10px"
                  fontSize="16px"
                  fontWeight={600}
                  _hover={{ opacity: 0.85 }}
                >
                  See the Ask
                </Button>
              </a>
              <a href="#coverage">
                <Button
                  variant="outline"
                  borderColor="#ffffff33"
                  color="#fff"
                  h="55px"
                  px="32px"
                  borderRadius="10px"
                  fontSize="16px"
                  fontWeight={600}
                  _hover={{ bg: "#ffffff11" }}
                >
                  View Coverage Map
                </Button>
              </a>
            </Box>
          </Fade>
        </VStack>
      </Container>
    </Box>
  );
};

export default ImpactHero;
