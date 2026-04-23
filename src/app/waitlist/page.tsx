"use client";

import WaitlistForm from "@/components/waitlist/form";
import Layout from "@/components/layout";
import { Box, Center, Container, Text } from "@chakra-ui/react";
import React from "react";

const Waitlist = () => {
  return (
    <Layout>
      <Box bg="#FBFBFB" py={{ base: "32px", md: "68px" }}>
        <Container maxW="container.xl">
          <Center>
            <Text
              textAlign={"center"}
              color="#1A1A1A"
              fontSize={{ base: "16px", md: "40px" }}
              fontWeight={700}
              w={{ base: "auto", md: "1102px" }}
            >
              Join the VaxAI Vision waitlist — we'll reach out as pilot access
              opens in your region.
            </Text>
          </Center>
        </Container>
      </Box>

      <Box my={{ base: "32px", md: "120px" }}>
        <Container maxW="container.xl">
          <WaitlistForm />
        </Container>
      </Box>
    </Layout>
  );
};

export default Waitlist;
