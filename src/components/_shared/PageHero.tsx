"use client";

import { Box, Container, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

type Mode = "clinical" | "editorial";

const PageHero = ({
  eyebrow,
  title,
  sub,
  mode = "clinical",
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  mode?: Mode;
  children?: React.ReactNode;
}) => {
  const bg = mode === "editorial" ? tokens.paper : tokens.bg;
  const ink = mode === "editorial" ? tokens.paperInk : tokens.ink;
  const muted = mode === "editorial" ? "rgba(26,20,16,0.6)" : tokens.muted;
  const rule = mode === "editorial" ? tokens.paperRule : tokens.rule;
  const headFont =
    mode === "editorial" ? tokens.serif : tokens.sans;
  const headWeight = mode === "editorial" ? 500 : 600;

  return (
    <Box bg={bg} color={ink}
         pt={{ base: "32px", md: "56px" }}
         pb={{ base: "48px", md: "72px" }}
         borderBottom={`1px solid ${rule}`}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        {eyebrow && (
          <Eyebrow color={mode === "editorial" ? tokens.paperBrick : tokens.brand}>
            {eyebrow}
          </Eyebrow>
        )}
        <Text
          as="h1"
          mt={eyebrow ? "20px" : "0"}
          fontFamily={headFont}
          fontWeight={headWeight}
          fontSize={{ base: "40px", md: "64px" }}
          lineHeight="1.02"
          letterSpacing="-0.03em"
          sx={{ textWrap: "balance" }}
          maxW="940px"
        >
          {title}
        </Text>
        {sub && (
          <Text
            mt="22px"
            fontSize={{ base: "16px", md: "18px" }}
            lineHeight="1.6"
            color={muted}
            maxW="640px"
            sx={{ textWrap: "pretty" }}
          >
            {sub}
          </Text>
        )}
        {children && <Box mt="32px">{children}</Box>}
      </Container>
    </Box>
  );
};

export default PageHero;
