"use client";

import ContactForm from "@/components/contact/form";
import Layout from "@/components/layout";
import { Box, Center, Container, Text } from "@chakra-ui/react";
import React from "react";

const Contact = () => {
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
              Do you have questions about our solutions or want to discuss a
              potential collaboration? Our team is here to help.
            </Text>
          </Center>
        </Container>
      </Box>

      <Box my={{ base: "32px", md: "120px" }}>
        <Container maxW="container.xl">
          <ContactForm />
        </Container>
      </Box>
    </Layout>
  );
};

export default Contact;
