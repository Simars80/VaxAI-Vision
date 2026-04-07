"use client";

import { Box, Button, Container, Text, VStack } from "@chakra-ui/react";
import React from "react";

const ImpactCTA = () => {
  return (
    <Box bg="#F7F9FC" py={{ base: "48px", md: "80px" }}>
      <Container maxW="container.md">
        <VStack spacing={6} textAlign="center">
          <Text
            fontSize={{ base: "24px", md: "36px" }}
            fontWeight={800}
            color="#1A1A1A"
          >
            Partner with Us
          </Text>
          <Text color="#667085" fontSize={{ base: "15px", md: "18px" }} maxW="560px">
            Join leading donors and global health organisations backing VaxAI
            Vision to end vaccine stockouts across Africa.
          </Text>
          <Box display="flex" gap="16px" flexWrap="wrap" justifyContent="center">
            <a href="mailto:vaxai.vision@gmail.com">
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
                Request a Demo
              </Button>
            </a>
            <a href="https://app.vaxaivision.com" target="_blank" rel="noopener noreferrer">
              <Button
                bg="transparent"
                color="#3A5BCC"
                border="2px solid #3A5BCC"
                h="52px"
                px="32px"
                borderRadius="10px"
                fontSize="16px"
                fontWeight={600}
                _hover={{ bg: "#EEF2FF" }}
              >
                View Live Dashboard
              </Button>
            </a>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default ImpactCTA;
