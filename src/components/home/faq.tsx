"use client";

import {
  Box,
  Container,
  Flex,
  Grid,
  GridItem,
  Text,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from "@chakra-ui/react";
import React from "react";
import { faqs } from "@/utils/enums";
import { tokens } from "./_tokens";
import { Eyebrow } from "./_atoms";

/* Reads from the existing src/utils/enums.jsx — no content duplication */

const FAQ = () => {
  return (
    <Box id="faq" bg={tokens.bg} py={{ base: "64px", md: "110px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1.5fr" }}
          gap={{ base: "32px", md: "80px" }}
          alignItems="start"
        >
          <GridItem>
            <Eyebrow>FAQ</Eyebrow>
            <Text
              as="h2"
              mt="14px"
              fontWeight={600}
              fontSize={{ base: "32px", md: "44px" }}
              lineHeight="1.05"
              letterSpacing="-0.03em"
            >
              Common questions.
            </Text>
            <Text mt="20px" fontSize="15px" lineHeight="1.65" color={tokens.muted}>
              Can&apos;t find what you need? Reach out at{" "}
              <a href="mailto:partnerships@vaxaivision.com" className="vax-link">
                partnerships@vaxaivision.com
              </a>
              .
            </Text>
          </GridItem>
          <GridItem>
            <Box borderTop={`1px solid ${tokens.rule}`}>
              <Accordion allowToggle border="none" bg="none">
                {faqs.map((data: { title: string; sub: string }, idx: number) => (
                  <AccordionItem
                    key={idx}
                    border="none"
                    borderBottom={`1px solid ${tokens.rule}`}
                    bg="transparent"
                  >
                    {({ isExpanded }) => (
                      <>
                        <h3>
                          <AccordionButton
                            border="none"
                            bg="transparent"
                            _hover={{ bg: "transparent" }}
                            padding="22px 4px"
                          >
                            <Box
                              as="span"
                              flex="1"
                              textAlign="left"
                              fontSize={{ base: "16px", md: "18px" }}
                              fontWeight={600}
                              color={tokens.ink}
                            >
                              {data.title}
                            </Box>
                            <Flex
                              w="24px"
                              h="24px"
                              borderRadius="999px"
                              border={`1px solid ${tokens.rule}`}
                              alignItems="center"
                              justifyContent="center"
                              color={tokens.muted}
                              fontSize="14px"
                              flexShrink={0}
                            >
                              {isExpanded ? "−" : "+"}
                            </Flex>
                          </AccordionButton>
                        </h3>
                        <AccordionPanel
                          paddingBottom="22px"
                          paddingRight={{ base: "16px", md: "44px" }}
                          paddingLeft="4px"
                          fontSize="14px"
                          lineHeight="1.65"
                          color={tokens.muted}
                        >
                          {data.sub}
                        </AccordionPanel>
                      </>
                    )}
                  </AccordionItem>
                ))}
              </Accordion>
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default FAQ;
