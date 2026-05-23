"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

type PinStatus = "ok" | "watch" | "alert";

function Pin({ x, y, status, label, sub }:
  { x: string; y: string; status: PinStatus; label: string; sub?: string }) {
  const c = status === "alert" ? tokens.alert : status === "watch" ? tokens.watch : tokens.ok;
  return (
    <>
      <Box position="absolute" sx={{ left: x, top: y }}
           w="11px" h="11px" borderRadius="999px" bg={c}
           border={`2px solid ${tokens.map}`}
           boxShadow={`0 0 0 1px ${c}, 0 4px 14px rgba(14,17,22,0.18)`} />
      <Box position="absolute" sx={{ left: `calc(${x} + 16px)`, top: y }}
           bg={tokens.map} padding="5px 9px" borderRadius="2px"
           border={`1px solid ${tokens.rule}`}
           className="vax-mono" fontSize="10px"
           letterSpacing="0.08em" color={tokens.ink}>
        {label}{sub ? ` · ${sub}` : ""}
      </Box>
    </>
  );
}

const CoverageMap = () => {
  return (
    <Box id="coverage" bg={tokens.map} color={tokens.ink}
         py={{ base: "80px", md: "120px" }} position="relative" overflow="hidden">
      {/* paper-map backdrop */}
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <rect width="1600" height="900" fill={tokens.water} />
        <path d="M -60 200 Q 220 120 480 200 T 920 240 Q 1100 280 1280 220 T 1660 320 L 1660 700 Q 1480 760 1280 700 T 880 760 Q 580 800 320 740 T -60 640 Z" fill={tokens.land} />
        <path d="M 100 820 Q 320 880 640 840 T 1080 860 L 1140 900 L 40 900 Z" fill={tokens.land} />
        {Array.from({ length: 9 }).map((_, i) => (
          <path key={i}
            d={`M ${-60 + i * 6} ${320 + i * 28} Q ${360 + i * 4} ${260 + i * 26} ${760 + i * 2} ${320 + i * 28} T 1660 ${380 + i * 24}`}
            fill="none" stroke="rgba(14,17,22,0.07)" strokeWidth="1" />
        ))}
        {[200, 400, 600, 800, 1000, 1200, 1400].map(xv => (
          <line key={xv} x1={xv} x2={xv} y1="0" y2="900" stroke="rgba(14,17,22,0.05)" />
        ))}
        {[180, 360, 540, 720].map(yv => (
          <line key={yv} x1="0" x2="1600" y1={yv} y2={yv} stroke="rgba(14,17,22,0.05)" />
        ))}
        <path d="M 280 640 C 480 560, 720 540, 880 580 S 1180 480, 1380 400" fill="none" stroke={tokens.brand} strokeWidth="1.6" strokeDasharray="3 7" />
      </svg>

      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }} sx={{ position: "relative", zIndex: 2 }}>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={{ base: "40px", md: "56px" }} alignItems="start">
          <GridItem>
            <Box bg="rgba(255,255,255,0.94)" sx={{ backdropFilter: "blur(8px)" }}
                 border={`1px solid ${tokens.rule}`}
                 padding={{ base: "28px", md: "40px 44px" }}>
              <Eyebrow color={tokens.alert}>Where we work</Eyebrow>
              <Text as="h2" mt="20px" fontWeight={600}
                    fontSize={{ base: "30px", md: "48px" }}
                    lineHeight="1.05" letterSpacing="-0.03em">
                340 facilities. <Box as="span" color={tokens.alert}>11 countries.</Box> One platform.
              </Text>
              <Text mt="20px" fontSize="16px" lineHeight="1.65" color={tokens.muted} maxW="460px">
                Live deployments span Nigeria, Kenya, Mozambique, Zambia, South Sudan, Uganda,
                Ghana, Senegal, Rwanda, Tanzania, and Nepal — with field pilots running in two
                additional regions.
              </Text>

              <Box mt="32px" pt="20px" borderTop={`1px solid ${tokens.rule}`}>
                <Grid templateColumns="repeat(3, 1fr)" gap="20px">
                  <GridItem>
                    <Flex alignItems="center" gap="8px" mb="6px">
                      <Box w="10px" h="10px" borderRadius="999px" bg={tokens.ok} />
                      <Text className="vax-mono" fontSize="10px" letterSpacing="0.12em" textTransform="uppercase" color={tokens.muted}>Stable</Text>
                    </Flex>
                    <Text fontWeight={600} fontSize="22px" className="vax-tabular">284</Text>
                  </GridItem>
                  <GridItem>
                    <Flex alignItems="center" gap="8px" mb="6px">
                      <Box w="10px" h="10px" borderRadius="999px" bg={tokens.watch} />
                      <Text className="vax-mono" fontSize="10px" letterSpacing="0.12em" textTransform="uppercase" color={tokens.muted}>Watch</Text>
                    </Flex>
                    <Text fontWeight={600} fontSize="22px" className="vax-tabular">48</Text>
                  </GridItem>
                  <GridItem>
                    <Flex alignItems="center" gap="8px" mb="6px">
                      <Box w="10px" h="10px" borderRadius="999px" bg={tokens.alert} />
                      <Text className="vax-mono" fontSize="10px" letterSpacing="0.12em" textTransform="uppercase" color={tokens.muted}>Alert</Text>
                    </Flex>
                    <Text fontWeight={600} fontSize="22px" color={tokens.alert} className="vax-tabular">8</Text>
                  </GridItem>
                </Grid>
              </Box>
            </Box>
          </GridItem>

          <GridItem display={{ base: "none", md: "block" }}>
            <Box position="relative" h="500px">
              <Pin x="12%" y="18%" status="ok" label="DAKAR" sub="92%" />
              <Pin x="22%" y="28%" status="ok" label="ABUJA" sub="89%" />
              <Pin x="40%" y="36%" status="alert" label="KANO" sub="87%" />
              <Pin x="28%" y="48%" status="ok" label="ACCRA" sub="94%" />
              <Pin x="56%" y="42%" status="watch" label="JUBA" sub="78%" />
              <Pin x="50%" y="56%" status="ok" label="KIGALI" sub="91%" />
              <Pin x="60%" y="68%" status="ok" label="MAPUTO" sub="88%" />
              <Pin x="32%" y="76%" status="ok" label="LUSAKA" sub="91%" />
              <Pin x="44%" y="82%" status="watch" label="DAR" sub="76%" />
              <Pin x="76%" y="22%" status="watch" label="KATHMANDU" sub="71%" />
              <Pin x="20%" y="62%" status="ok" label="NAIROBI" sub="94%" />
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default CoverageMap;
