"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";
import { FiCheck } from "react-icons/fi";

const fundingTiers = [
  {
    amount: "$50,000",
    title: "Seed Partner",
    accent: tokens.muted,
    bg: "#fff",
    inkColor: tokens.ink,
    outcomes: [
      "Deploy across 5 new facilities in sub-Saharan Africa",
      "AI-powered inventory tracking and cold chain monitoring",
      "Co-branded impact report at year end",
      "Quarterly data briefings with anonymised insights",
    ],
  },
  {
    amount: "$250,000",
    title: "Growth Partner",
    accent: tokens.brand,
    bg: tokens.brand,
    inkColor: "#fff",
    featured: true,
    outcomes: [
      "Scale to 30+ facilities across 2 LMIC countries",
      "Full platform suite: forecasting, coverage mapping, vision AI",
      "Named recognition in all public impact materials",
      "Advisory seat on our programme steering committee",
      "Real-time access to anonymised platform dashboard",
    ],
  },
  {
    amount: "$1,000,000",
    title: "Strategic Partner",
    accent: tokens.ink,
    bg: "#fff",
    inkColor: tokens.ink,
    outcomes: [
      "Fund a full country-level rollout (50+ facilities)",
      "Integration with national HMIS, DHIS2, OpenLMIS systems",
      "Co-develop AI features aligned to your mandate",
      "Joint press release and media engagement",
      "Board observer seat",
      "Dedicated impact measurement framework",
    ],
  },
];

const milestones = [
  { year: "Q3 2026", label: "Pilot across 50 facilities in sub-Saharan Africa with full AI stack" },
  { year: "Q1 2027", label: "Expand to 200+ facilities across 3 countries with DHIS2 & OpenLMIS integration" },
  { year: "Q3 2027", label: "Launch coverage mapping and predictive forecasting in 5 LMIC countries" },
  { year: "Q4 2027", label: "1,000+ facilities across 8+ LMICs — targeting zero vaccine stockouts" },
];

const TheAsk = () => {
  return (
    <Box id="ask" bg={tokens.bg} py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        {/* Heading */}
        <Box mb={{ base: "48px", md: "72px" }} maxW="820px">
          <Eyebrow>The ask</Eyebrow>
          <Text as="h2" mt="14px" fontWeight={600}
                fontSize={{ base: "32px", md: "52px" }}
                lineHeight="1.02" letterSpacing="-0.03em" sx={{ textWrap: "balance" }}>
            Partner with us to save lives at scale.
          </Text>
          <Text mt="20px" fontSize={{ base: "16px", md: "18px" }} lineHeight="1.6"
                color={tokens.muted} maxW="640px" sx={{ textWrap: "pretty" }}>
            We are raising <Box as="span" color={tokens.ink} fontWeight={600}>$2M in grant and
            philanthropic capital</Box> to deploy VaxAI Vision across low- and middle-income
            countries, starting with sub-Saharan Africa.
          </Text>
        </Box>

        {/* Funding tiers */}
        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
              gap={{ base: "16px", md: "20px" }}
              mb={{ base: "64px", md: "96px" }}>
          {fundingTiers.map((tier) => (
            <GridItem key={tier.title} position="relative">
              {tier.featured && (
                <Box position="absolute"
                     sx={{ top: -14, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
                     bg={tokens.ink} color="#fff"
                     px="14px" py="5px" borderRadius="999px"
                     className="vax-mono"
                     fontSize="10px" letterSpacing="0.18em"
                     fontWeight={600}>
                  RECOMMENDED
                </Box>
              )}

              <Box bg={tier.bg} color={tier.inkColor}
                   border={tier.featured ? "none" : `1px solid ${tokens.rule}`}
                   borderRadius="12px"
                   padding={{ base: "28px 24px", md: "36px 32px" }}
                   h="100%" display="flex" flexDir="column"
                   boxShadow={tier.featured ? "0 18px 40px rgba(58,91,204,0.25)" : "none"}>
                <Box w="32px" h="3px" bg={tier.featured ? "#fff" : tier.accent} mb="20px" />
                <Text fontWeight={600} fontSize={{ base: "32px", md: "42px" }}
                      letterSpacing="-0.025em" lineHeight="1.0" mb="6px" className="vax-tabular">
                  {tier.amount}
                </Text>
                <Text className="vax-mono" fontSize="11px" letterSpacing="0.18em"
                      textTransform="uppercase"
                      color={tier.featured ? "rgba(255,255,255,0.85)" : tier.accent}
                      mb="24px">
                  {tier.title}
                </Text>

                <Box flex="1" pt="20px"
                     borderTop={tier.featured ? "1px solid rgba(255,255,255,0.2)" : `1px solid ${tokens.rule}`}>
                  <Flex flexDir="column" gap="14px">
                    {tier.outcomes.map((o, i) => (
                      <Flex key={i} alignItems="flex-start" gap="10px">
                        <Box w="18px" h="18px" mt="2px"
                             borderRadius="999px"
                             bg={tier.featured ? "rgba(255,255,255,0.18)" : `${tier.accent}1f`}
                             color={tier.featured ? "#fff" : tier.accent}
                             display="grid" sx={{ placeItems: "center" }}
                             flexShrink={0}>
                          <FiCheck size={11} />
                        </Box>
                        <Text fontSize="14px" lineHeight="1.55"
                              color={tier.featured ? "rgba(255,255,255,0.88)" : tokens.muted}>
                          {o}
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                </Box>

                <Box mt="28px">
                  <a href="mailto:partnerships@vaxaivision.com"
                     style={{
                       display: "inline-flex", alignItems: "center", justifyContent: "center",
                       width: "100%",
                       padding: "14px 22px", borderRadius: 6,
                       fontSize: 14, fontWeight: 600,
                       background: tier.featured ? "#fff" : tokens.ink,
                       color: tier.featured ? tokens.brand : "#fff",
                     }}>
                    Get in touch →
                  </a>
                </Box>
              </Box>
            </GridItem>
          ))}
        </Grid>

        {/* Roadmap */}
        <Box bg={tokens.paper} color={tokens.paperInk}
             padding={{ base: "32px 28px", md: "56px 64px" }}>
          <Eyebrow color={tokens.paperBrick}>Where your funding goes</Eyebrow>
          <Text as="h3" mt="14px"
                className="vax-serif"
                fontWeight={500}
                fontSize={{ base: "28px", md: "40px" }}
                lineHeight="1.0" letterSpacing="-0.025em"
                sx={{ textWrap: "balance" }}>
            A clear roadmap with measurable milestones — tracked and reported quarterly.
          </Text>

          <Box mt="40px" position="relative">
            <Box position="absolute" left={{ base: "11px", md: "15px" }} top="6px" bottom="6px"
                 w="1px" bg="rgba(26,20,16,0.22)" />
            <Flex flexDir="column" gap={{ base: "28px", md: "32px" }}>
              {milestones.map((m, i) => (
                <Flex key={m.year} gap={{ base: "20px", md: "28px" }} position="relative">
                  <Box w={{ base: "24px", md: "32px" }} h={{ base: "24px", md: "32px" }}
                       borderRadius="999px" bg={tokens.paperBrick} color={tokens.paper}
                       display="grid" sx={{ placeItems: "center" }}
                       flexShrink={0} zIndex={1}
                       fontWeight={700} fontSize="11px" className="vax-mono">
                    {String(i + 1).padStart(2, "0")}
                  </Box>
                  <Box pt="4px">
                    <Text className="vax-mono" fontSize="11px" letterSpacing="0.16em"
                          textTransform="uppercase" color={tokens.paperBrick} mb="6px">
                      {m.year}
                    </Text>
                    <Text fontSize={{ base: "15px", md: "17px" }} lineHeight="1.55" color={tokens.paperInk}>
                      {m.label}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Box>

          <Flex mt="48px" pt="32px" borderTop="1px solid rgba(26,20,16,0.18)"
                justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="16px">
            <Box>
              <Text className="vax-serif" fontSize={{ base: "20px", md: "24px" }}
                    fontWeight={600} letterSpacing="-0.015em" mb="4px">
                Ready to make an impact?
              </Text>
              <Text fontSize="14px" color="rgba(26,20,16,0.65)">
                Reach out directly — we respond within 48 hours.
              </Text>
            </Box>
            <a href="mailto:partnerships@vaxaivision.com"
               style={{
                 background: tokens.paperInk, color: tokens.paper,
                 padding: "15px 26px", borderRadius: 6,
                 fontSize: 15, fontWeight: 600,
               }}>
              partnerships@vaxaivision.com →
            </a>
          </Flex>
        </Box>
      </Container>
    </Box>
  );
};

export default TheAsk;
