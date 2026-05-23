"use client";

import { Box, Container, Flex, Grid, GridItem, Image, Text } from "@chakra-ui/react";
import Link from "next/link";
import React from "react";
import { MdEmail } from "react-icons/md";
import { FaLinkedin } from "react-icons/fa6";
import { team } from "@/utils/enums";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

const Team = () => {
  return (
    <Box bg="#fafbfd" py={{ base: "64px", md: "110px" }} borderTop={`1px solid ${tokens.rule}`}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Eyebrow>Founding team</Eyebrow>
        <Text
          as="h2"
          mt="14px"
          mb="48px"
          fontWeight={600}
          fontSize={{ base: "32px", md: "44px" }}
          lineHeight="1.05"
          letterSpacing="-0.03em"
          maxW="700px"
        >
          The people behind the platform.
        </Text>

        <Grid
          templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
          gap={{ base: "32px", md: "48px" }}
        >
          {team.map(
            (
              data: {
                name: string;
                position: string;
                bio: string;
                image: string;
                email: string;
                linkedIn: string;
              },
              idx: number
            ) => (
              <GridItem key={idx}
                bg="#fff"
                border={`1px solid ${tokens.rule}`}
                borderRadius="10px"
                overflow="hidden"
                display="flex"
                flexDir="column">
                <Box overflow="hidden" sx={{ aspectRatio: "4/3" }}>
                  <Image src={data.image} alt={data.name} w="100%" h="100%" objectFit="cover" />
                </Box>
                <Box padding={{ base: "24px", md: "32px" }} flex="1" display="flex" flexDir="column">
                  <Text
                    className="vax-mono"
                    fontSize="10px"
                    color={tokens.muted}
                    letterSpacing="0.16em"
                    textTransform="uppercase"
                    mb="8px"
                  >
                    {data.position}
                  </Text>
                  <Text
                    fontSize={{ base: "20px", md: "24px" }}
                    fontWeight={600}
                    letterSpacing="-0.02em"
                    mb="14px"
                  >
                    {data.name}
                  </Text>
                  <Text
                    fontSize="14px"
                    fontWeight={400}
                    color={tokens.muted}
                    lineHeight="1.65"
                    flex="1"
                  >
                    {data.bio}
                  </Text>

                  <Flex alignItems="center" gap="10px" mt="24px" pt="20px" borderTop={`1px solid ${tokens.rule}`}>
                    <Link href={`mailto:${data.email}`} aria-label={`Email ${data.name}`}>
                      <Box
                        w="32px"
                        h="32px"
                        bg={tokens.brandSoft}
                        color={tokens.brand}
                        borderRadius="999px"
                        display="grid"
                        sx={{ placeItems: "center" }}
                      >
                        <MdEmail size={14} />
                      </Box>
                    </Link>
                    <Link
                      href={data.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${data.name} on LinkedIn`}
                    >
                      <Box
                        w="32px"
                        h="32px"
                        bg={tokens.brandSoft}
                        color={tokens.brand}
                        borderRadius="999px"
                        display="grid"
                        sx={{ placeItems: "center" }}
                      >
                        <FaLinkedin size={14} />
                      </Box>
                    </Link>
                    <Text ml="auto" fontSize="12px" color={tokens.muted}>
                      {data.email}
                    </Text>
                  </Flex>
                </Box>
              </GridItem>
            )
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default Team;
