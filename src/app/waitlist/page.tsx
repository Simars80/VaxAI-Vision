"use client";

import React from "react";
import { Box, Container } from "@chakra-ui/react";
import Layout from "@/components/layout";
import WaitlistForm from "@/components/waitlist/form";
import PageHero from "@/components/_shared/PageHero";
import { tokens } from "@/components/home/_tokens";

const Waitlist = () => {
  return (
    <Layout>
      <PageHero
        eyebrow="Pilot access"
        title={<>Join the VaxAI Vision waitlist.</>}
        sub="Tell us where you work and what you're trying to fix. We open pilots in waves of 5–10 facilities and reach out as access opens in your region."
      />

      <Box bg="#fafbfd" py={{ base: "48px", md: "96px" }} borderTop={`1px solid ${tokens.rule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <WaitlistForm />
        </Container>
      </Box>
    </Layout>
  );
};

export default Waitlist;
