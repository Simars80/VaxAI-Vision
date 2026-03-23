"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from "@chakra-ui/react";
import { faqs } from "@/utils/enums";
import { FaCaretRight, FaCaretDown } from "react-icons/fa";

const Faqs = () => {
  return (
    <Box
      py={{ base: "40px", md: "70px" }}
      mt={{ base: "40px", md: "120px" }}
      mb="80px"
    >
      <Container maxW="container.xl">
        <Text
          color="#1A1A1A"
          fontSize={{ base: "16px", md: "42px" }}
          fontWeight={700}
          textAlign={"center"}
        >
          Find answers to commonly asked questions
        </Text>

        <Box mt="29px">
          <Grid
            templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
            gap={{ base: "16px", md: "64px" }}
          >
            <GridItem>
              <Accordion allowToggle={true} border="none" bg="none">
                {faqs.slice(0, 4).map((data, idx) => (
                  <AccordionItem key={idx} border="none" bg="#F3F4F6" mb="16px">
                    {({ isExpanded }) => (
                      <>
                        <h2>
                          <AccordionButton border="none">
                            <Box
                              as="span"
                              flex="1"
                              textAlign="left"
                              fontSize={"16px"}
                              fontWeight={700}
                              color="#1A1A1A"
                            >
                              {data.title}
                            </Box>
                            {isExpanded ? (
                              <FaCaretDown color="#898989" />
                            ) : (
                              <FaCaretRight color="#898989" />
                            )}
                          </AccordionButton>
                        </h2>
                        <AccordionPanel>{data.sub}</AccordionPanel>
                      </>
                    )}
                  </AccordionItem>
                ))}
              </Accordion>
            </GridItem>
            <GridItem>
              <Accordion allowToggle={true} border="none" bg="none">
                {faqs.slice(4).map((data, idx) => (
                  <AccordionItem key={idx} border="none" bg="#F3F4F6" mb="16px">
                    {({ isExpanded }) => (
                      <>
                        <h2>
                          <AccordionButton border="none">
                            <Box
                              as="span"
                              flex="1"
                              textAlign="left"
                              fontSize={"16px"}
                              fontWeight={700}
                              color="#1A1A1A"
                            >
                              {data.title}
                            </Box>
                            {isExpanded ? (
                              <FaCaretDown color="#898989" />
                            ) : (
                              <FaCaretRight color="#898989" />
                            )}
                          </AccordionButton>
                        </h2>
                        <AccordionPanel>{data.sub}</AccordionPanel>
                      </>
                    )}
                  </AccordionItem>
                ))}
              </Accordion>
            </GridItem>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default Faqs;
