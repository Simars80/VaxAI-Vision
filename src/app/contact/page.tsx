"use client";

import React from "react";
import { Box, Container } from "@chakra-ui/react";
import Layout from "@/components/layout";
import ContactForm from "@/components/contact/form";
import PageHero from "@/components/_shared/PageHero";
import { tokens } from "@/components/home/_tokens";

const Contact = () => {
  return (
    <Layout>
      <PageHero
        eyebrow="Get in touch"
        title={<>Tell us what you&apos;re trying to fix.</>}
        sub="Questions about pilots, integrations, or partnerships. The team reads every message and replies within 48 hours."
      />

      <Box bg="#fafbfd" py={{ base: "48px", md: "96px" }} borderTop={`1px solid ${tokens.rule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <ContactForm />
        </Container>
      </Box>
    </Layout>
  );
};

export default Contact;
