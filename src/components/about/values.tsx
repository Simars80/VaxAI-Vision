"use client";
import { values } from "@/utils/enums";
import { Box, Container, Grid, GridItem, Image, Text } from "@chakra-ui/react";
import React from "react";
import { Slide } from "react-awesome-reveal";
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from "@chakra-ui/react";
import { FaCaretRight, FaCaretDown } from "react-icons/fa";

const ValuesComponent = () => {
  return (
    <Box mt={{ base: "68px", md: "80px" }} py={{ base: 0, md: "113px" }}>
      <Container maxW="container.xl">
        <Grid
          templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
          gap="63px"
          alignItems={{ base: "none", md: "none" }}
        >
          <GridItem>
            <Slide direction="left" triggerOnce>
              <Text
                color="#1A1A1A"
                fontSize={{ base: "24px", md: "42px" }}
                fontWeight={700}
                textAlign={{ base: "center", md: "left" }}
              >
                Our core values
              </Text>
            </Slide>

            <Box mt="40px" display={"flex"} flexDir={"column"} gap="32px">
              <Slide direction="left" cascade triggerOnce>
                <Accordion allowToggle={true} border="none" bg="none">
                  {values.map((data, idx) => (
                    <AccordionItem key={idx} border="none" bg='#000' mb='16px'>
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
                                color="#fff"
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
                          <AccordionPanel
                            color="#667085"
                            fontSize={"18px"}
                            fontWeight={400}
                            bg="#fff"
                          >
                            {data.sub}
                          </AccordionPanel>
                        </>
                      )}
                    </AccordionItem>
                  ))}
                </Accordion>
                
              </Slide>
            </Box>
          </GridItem>

          <GridItem display={{base:'none', md:'block'}}>
            <Slide direction="right" triggerOnce>
              <Image
                src="https://res.cloudinary.com/alonexx/image/upload/v1718901735/image_10_1_mymbd1.png"
                alt="about"
                
              />
            </Slide>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default ValuesComponent;
