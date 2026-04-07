"use client";

import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Text,
  VStack,
} from "@chakra-ui/react";
import React from "react";
import { Fade, Slide } from "react-awesome-reveal";
import { FiCheck } from "react-icons/fi";

const fundingTiers = [
  {
    amount: "$50,000",
    title: "Seed Partner",
    color: "#718096",
    outcomes: [
      "Fund deployment across 5 new health facilities",
      "Co-branded impact report at year end",
      "Quarterly data briefings",
    ],
  },
  {
    amount: "$250,000",
    title: "Growth Partner",
    color: "#3A5BCC",
    featured: true,
    outcomes: [
      "Scale to 30 new facilities across 2 countries",
      "Named recognition in all public impact materials",
      "Advisory seat on our programme steering committee",
      "Real-time access to anonymised platform dashboard",
    ],
  },
  {
    amount: "$1,000,000",
    title: "Strategic Partner",
    color: "#F56630",
    outcomes: [
      "Fund a full country-level rollout (50+ facilities)",
      "Co-develop AI features aligned to your mandate",
      "Joint press release and media engagement",
      "Board observer seat",
      "Dedicated impact measurement framework",
    ],
  },
];

const milestones = [
  { year: "Q3 2025", label: "Expand to 600 facilities across West Africa" },
  { year: "Q4 2025", label: "Launch East Africa corridor (Kenya, Tanzania, Uganda)" },
  { year: "Q2 2026", label: "Integrate national HMIS data feeds in 3 countries" },
  { year: "Q4 2026", label: "1,500+ facilities, 10 countries, $0 stockout-related waste target" },
];

const TheAsk = () => {
  return (
    <Box id="ask" bg="#1A1A1A" py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl">
        {/* Heading */}
        <Slide direction="up" triggerOnce>
          <VStack
            spacing={4}
            mb={{ base: "48px", md: "72px" }}
            align="center"
            textAlign="center"
          >
            <Text
              color="#3A5BCC"
              fontSize="14px"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing="2px"
            >
              The Ask
            </Text>
            <Text
              color="#fff"
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight={800}
              maxW="750px"
              lineHeight="1.2"
            >
              Partner with us to save{" "}
              <Text as="span" color="#F56630">
                lives at scale
              </Text>
            </Text>
            <Text color="#718096" fontSize={{ base: "15px", md: "18px" }} maxW="620px">
              We are raising{" "}
              <Text as="span" color="#fff" fontWeight={700}>
                $2M in grant and philanthropic capital
              </Text>{" "}
              to expand VaxAI across 10 African countries by end of 2026.
            </Text>
          </VStack>
        </Slide>

        {/* Funding tiers */}
        <Grid
          templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap={{ base: "20px", md: "24px" }}
          mb={{ base: "64px", md: "96px" }}
        >
          {fundingTiers.map((tier, idx) => (
            <Fade key={idx} triggerOnce delay={idx * 150}>
              <Box
                bg={tier.featured ? "#fff" : "#141414"}
                borderRadius="20px"
                p={{ base: "28px", md: "40px" }}
                border={tier.featured ? "none" : "1px solid #2D2D2D"}
                position="relative"
                h="full"
              >
                {tier.featured && (
                  <Box
                    position="absolute"
                    top="-14px"
                    left="50%"
                    transform="translateX(-50%)"
                    bg="#3A5BCC"
                    color="#fff"
                    fontSize="12px"
                    fontWeight={700}
                    px="16px"
                    py="5px"
                    borderRadius="full"
                    whiteSpace="nowrap"
                  >
                    MOST POPULAR
                  </Box>
                )}

                <Box w="32px" h="4px" bg={tier.color} borderRadius="full" mb="20px" />
                <Text
                  fontSize={{ base: "32px", md: "40px" }}
                  fontWeight={800}
                  color={tier.featured ? "#1A1A1A" : "#fff"}
                  lineHeight="1"
                  mb="4px"
                >
                  {tier.amount}
                </Text>
                <Text
                  fontSize="16px"
                  fontWeight={700}
                  color={tier.color}
                  mb="24px"
                >
                  {tier.title}
                </Text>

                <Divider borderColor={tier.featured ? "#E8E8E8" : "#2D2D2D"} mb="24px" />

                <VStack align="flex-start" spacing={3}>
                  {tier.outcomes.map((o, i) => (
                    <Box key={i} display="flex" alignItems="flex-start" gap="10px">
                      <Box
                        w="20px"
                        h="20px"
                        bg={`${tier.color}20`}
                        borderRadius="full"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                        mt="1px"
                      >
                        <FiCheck size={11} color={tier.color} />
                      </Box>
                      <Text
                        fontSize="14px"
                        color={tier.featured ? "#4A5568" : "#A0AEC0"}
                        lineHeight="1.6"
                      >
                        {o}
                      </Text>
                    </Box>
                  ))}
                </VStack>

                <Box mt="32px">
                  <a href="mailto:partnerships@vaxai.com">
                    <Button
                      w="full"
                      h="50px"
                      bg={tier.featured ? "#3A5BCC" : "transparent"}
                      color={tier.featured ? "#fff" : tier.color}
                      border={tier.featured ? "none" : `1px solid ${tier.color}44`}
                      borderRadius="10px"
                      fontSize="15px"
                      fontWeight={600}
                      _hover={{
                        opacity: 0.85,
                        bg: tier.featured ? "#3A5BCC" : `${tier.color}11`,
                      }}
                    >
                      Get in Touch
                    </Button>
                  </a>
                </Box>
              </Box>
            </Fade>
          ))}
        </Grid>

        {/* Roadmap */}
        <Slide direction="up" triggerOnce>
          <Box
            bg="#141414"
            borderRadius="20px"
            border="1px solid #2D2D2D"
            p={{ base: "32px", md: "56px" }}
          >
            <Text
              color="#fff"
              fontSize={{ base: "22px", md: "30px" }}
              fontWeight={800}
              mb="8px"
            >
              Where your funding goes
            </Text>
            <Text color="#718096" fontSize="15px" mb="40px">
              A clear roadmap with measurable milestones — tracked and reported quarterly.
            </Text>

            <Box position="relative">
              {/* Vertical line */}
              <Box
                position="absolute"
                left={{ base: "12px", md: "16px" }}
                top="8px"
                bottom="8px"
                w="2px"
                bg="#2D2D2D"
              />

              <VStack align="flex-start" spacing={8}>
                {milestones.map((m, idx) => (
                  <Box key={idx} display="flex" gap={{ base: "20px", md: "32px" }} position="relative">
                    <Box
                      w={{ base: "26px", md: "34px" }}
                      h={{ base: "26px", md: "34px" }}
                      borderRadius="full"
                      bg="#3A5BCC"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                      zIndex={1}
                    >
                      <Text color="#fff" fontSize="11px" fontWeight={800}>
                        {idx + 1}
                      </Text>
                    </Box>
                    <Box pt="4px">
                      <Text color="#3A5BCC" fontSize="13px" fontWeight={700} mb="4px">
                        {m.year}
                      </Text>
                      <Text color="#E2E8F0" fontSize={{ base: "15px", md: "17px" }} fontWeight={500}>
                        {m.label}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </VStack>
            </Box>

            <Box
              mt="48px"
              pt="40px"
              borderTop="1px solid #2D2D2D"
              display="flex"
              flexDir={{ base: "column", md: "row" }}
              alignItems={{ base: "flex-start", md: "center" }}
              justifyContent="space-between"
              gap="20px"
            >
              <Box>
                <Text color="#fff" fontSize={{ base: "18px", md: "22px" }} fontWeight={700} mb="4px">
                  Ready to make an impact?
                </Text>
                <Text color="#718096" fontSize="14px">
                  Reach out directly — we respond within 48 hours.
                </Text>
              </Box>
              <a href="mailto:partnerships@vaxai.com">
                <Button
                  bg="#3A5BCC"
                  color="#fff"
                  h="52px"
                  px="32px"
                  borderRadius="10px"
                  fontSize="15px"
                  fontWeight={600}
                  _hover={{ opacity: 0.85 }}
                  flexShrink={0}
                >
                  partnerships@vaxai.com
                </Button>
              </a>
            </Box>
          </Box>
        </Slide>
      </Container>
    </Box>
  );
};

export default TheAsk;
