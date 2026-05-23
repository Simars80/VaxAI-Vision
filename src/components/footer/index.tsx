"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { FaLinkedin } from "react-icons/fa6";
import { MdEmail } from "react-icons/md";
import { Logo } from "@/components/home/_atoms";
import { tokens } from "@/components/home/_tokens";

const cols: { h: string; items: { label: string; href: string }[] }[] = [
  {
    h: "Platform",
    items: [
      { label: "Inventory", href: "/demo" },
      { label: "Forecasting", href: "/demo?tab=forecasting" },
      { label: "Cold chain", href: "/demo" },
      { label: "Vision AI", href: "/demo?tab=vision" },
      { label: "Coverage maps", href: "/impact" },
    ],
  },
  {
    h: "Solutions",
    items: [
      { label: "For ministries", href: "/solutions" },
      { label: "For NGOs", href: "/solutions" },
      { label: "For donors", href: "/impact" },
      { label: "Integrations", href: "/solutions" },
      { label: "Live demo", href: "/demo" },
    ],
  },
  {
    h: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Impact", href: "/impact" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Waitlist", href: "/waitlist" },
    ],
  },
  {
    h: "Resources",
    items: [
      { label: "Documentation", href: "/solutions" },
      { label: "Model cards", href: "/solutions" },
      { label: "Security", href: "/contact" },
      { label: "Status", href: "/" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

const Footer = () => {
  return (
    <Box
      bg={tokens.navBg}
      color="rgba(255,255,255,0.8)"
      pt={{ base: "64px", md: "88px" }}
      pb="40px"
    >
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1.4fr repeat(4, 1fr)" }}
          gap={{ base: "36px", md: "40px" }}
        >
          <GridItem>
            <Logo inverted />
            <Text
              mt="18px"
              fontSize="13px"
              lineHeight="1.6"
              color="rgba(255,255,255,0.55)"
              maxW="320px"
            >
              AI-driven vaccine supply chain intelligence for last-mile immunisation
              programmes.
            </Text>
            <Flex mt="20px" gap="10px">
              <a
                href="https://www.linkedin.com/company/vaxai-vision/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="VaxAI Vision on LinkedIn"
              >
                <Box
                  w="32px"
                  h="32px"
                  borderRadius="999px"
                  bg="rgba(255,255,255,0.08)"
                  display="grid"
                  placeItems="center"
                >
                  <FaLinkedin color="#fff" size={14} />
                </Box>
              </a>
              <a
                href="mailto:partnerships@vaxaivision.com"
                aria-label="Email partnerships@vaxaivision.com"
              >
                <Box
                  w="32px"
                  h="32px"
                  borderRadius="999px"
                  bg="rgba(255,255,255,0.08)"
                  display="grid"
                  placeItems="center"
                >
                  <MdEmail color="#fff" size={16} />
                </Box>
              </a>
            </Flex>

            <Text mt="24px" fontSize="12px" color="rgba(255,255,255,0.45)" lineHeight="1.5">
              254 Chapman Rd, Ste 208
              <br />
              Newark, Delaware, 19702
            </Text>
          </GridItem>

          {cols.map((c) => (
            <GridItem key={c.h}>
              <Text
                fontSize="11px"
                letterSpacing="0.16em"
                textTransform="uppercase"
                color="rgba(255,255,255,0.5)"
                mb="16px"
                className="vax-mono"
              >
                {c.h}
              </Text>
              <Flex flexDir="column" gap="10px">
                {c.items.map((it) => (
                  <Link
                    key={it.label}
                    href={it.href}
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.78)",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {it.label}
                  </Link>
                ))}
              </Flex>
            </GridItem>
          ))}
        </Grid>

        <Flex
          mt="48px"
          pt="24px"
          borderTop="1px solid rgba(255,255,255,0.1)"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap="14px"
        >
          <Text fontSize="12px" color="rgba(255,255,255,0.45)">
            © 2026 VaxAI Vision · All rights reserved
          </Text>
          <Flex gap="24px" flexWrap="wrap">
            <Link href="/contact" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Privacy
            </Link>
            <Link href="/contact" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Terms
            </Link>
            <Link href="/contact" style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              Security
            </Link>
            <Text fontSize="12px" color="rgba(255,255,255,0.45)">
              ● Status: all systems normal
            </Text>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
