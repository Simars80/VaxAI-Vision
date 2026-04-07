"use client";

import React, { useState } from "react";
import {
  Box,
  Container,
  Text,
  Button,
  Spinner,
  Center,
} from "@chakra-ui/react";
import Layout from "@/components/layout";
import Link from "next/link";

export default function DemoPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <Layout>
      {/* Header bar */}
      <Box bg="#0F172A" py={{ base: "24px", md: "32px" }} borderBottom="1px solid #1E293B">
        <Container maxW="container.xl">
          <Box
            display="flex"
            alignItems={{ base: "flex-start", md: "center" }}
            justifyContent="space-between"
            flexDir={{ base: "column", md: "row" }}
            gap="16px"
          >
            <Box>
              <Text
                color="#fff"
                fontSize={{ base: "20px", md: "28px" }}
                fontWeight={700}
              >
                Live Dashboard Demo
              </Text>
              <Text color="#94A3B8" fontSize={{ base: "13px", md: "15px" }} mt="4px">
                Explore VaxAI Vision's real-time operational intelligence — inventory, cold chain, coverage maps &amp; forecasting.
              </Text>
            </Box>
            <Box display="flex" gap="12px" flexWrap="wrap">
              <Box
                px="12px"
                py="6px"
                borderRadius="full"
                bg="#10B981"
                display="flex"
                alignItems="center"
                gap="6px"
              >
                <Box w="6px" h="6px" borderRadius="full" bg="#fff" />
                <Text color="#fff" fontSize="12px" fontWeight={600}>
                  Live Data
                </Text>
              </Box>
              <Link href="#solutions">
                <Button
                  size="sm"
                  bg="#3A5BCC"
                  color="#fff"
                  borderRadius="8px"
                  _hover={{ opacity: 0.85 }}
                  fontSize="13px"
                >
                  Request Access
                </Button>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Iframe embed */}
      <Box bg="#0F172A" minH={{ base: "70vh", md: "85vh" }} position="relative">
        {!loaded && (
          <Center
            position="absolute"
            inset={0}
            zIndex={10}
            flexDir="column"
            gap="16px"
          >
            <Spinner size="xl" color="#3A5BCC" thickness="4px" />
            <Text color="#94A3B8" fontSize="14px">
              Loading live dashboard…
            </Text>
          </Center>
        )}
        <iframe
          src="https://app.vaxaivision.com?demo=true"
          title="VaxAI Vision Live Demo"
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "85vh",
            border: "none",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
          allow="fullscreen"
        />
      </Box>

      {/* Footer CTA */}
      <Box bg="#1A1A1A" py={{ base: "40px", md: "64px" }} textAlign="center">
        <Container maxW="container.md">
          <Text
            color="#fff"
            fontSize={{ base: "20px", md: "32px" }}
            fontWeight={700}
            mb="12px"
          >
            Ready to deploy VaxAI at scale?
          </Text>
          <Text color="#94A3B8" fontSize={{ base: "14px", md: "16px" }} mb="28px">
            Book a personalised walkthrough with our team and see how VaxAI
            Vision fits your healthcare system.
          </Text>
          <Box display="flex" justifyContent="center" gap="16px" flexWrap="wrap">
            <Link href="/contact">
              <Button
                bg="#3A5BCC"
                color="#fff"
                h="52px"
                px="32px"
                borderRadius="10px"
                fontSize="16px"
                fontWeight={600}
                _hover={{ opacity: 0.85 }}
              >
                Contact Us
              </Button>
            </Link>
            <Link href="/">
              <Button
                bg="transparent"
                color="#fff"
                h="52px"
                px="32px"
                borderRadius="10px"
                fontSize="16px"
                fontWeight={600}
                border="2px solid #3A5BCC"
                _hover={{ opacity: 0.85 }}
              >
                Back to Home
              </Button>
            </Link>
          </Box>
        </Container>
      </Box>
    </Layout>
  );
}
