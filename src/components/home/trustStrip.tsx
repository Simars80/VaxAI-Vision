"use client";

import { Box, Container, Flex, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";

const items = ["DHIS2", "mSupply", "OpenLMIS", "FHIR R4", "WHO PQS", "UNICEF SD"];

const TrustStrip = () => {
  return (
    <Box
      bg={tokens.bg}
      borderTop={`1px solid ${tokens.rule}`}
      borderBottom={`1px solid ${tokens.rule}`}
    >
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Flex
          alignItems="center"
          gap={{ base: "24px", md: "48px" }}
          py="20px"
          flexWrap="wrap"
          justifyContent="center"
        >
          <Text
            fontSize="11px"
            letterSpacing="0.22em"
            textTransform="uppercase"
            color={tokens.muted}
            className="vax-mono"
          >
            Integrates with
          </Text>
          {items.map((n) => (
            <Text
              key={n}
              fontSize="14px"
              fontWeight={500}
              color={tokens.ink}
              letterSpacing="-0.01em"
              opacity={0.75}
            >
              {n}
            </Text>
          ))}
        </Flex>
      </Container>
    </Box>
  );
};

export default TrustStrip;
