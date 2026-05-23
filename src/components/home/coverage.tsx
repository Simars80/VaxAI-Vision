"use client";

import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";
import { Eyebrow, CTA } from "./_atoms";

type PinStatus = "ok" | "watch" | "alert";

function FacilityPin({
  x,
  y,
  status,
  label,
  sub,
  detail,
  big,
}: {
  x: string;
  y: string;
  status: PinStatus;
  label: string;
  sub?: string;
  detail?: { coverage: string; facilities: string; alert: string };
  big?: boolean;
}) {
  const c =
    status === "alert" ? tokens.alert : status === "watch" ? tokens.watch : tokens.ok;
  return (
    <>
      <Box
        position="absolute"
        sx={{ left: x, top: y }}
        w={big ? "16px" : "10px"}
        h={big ? "16px" : "10px"}
        borderRadius="999px"
        bg={c}
        border={`${big ? 3 : 2}px solid ${tokens.map}`}
        boxShadow={`0 0 0 1px ${c}, 0 4px 14px rgba(14,17,22,0.18)`}
      />
      {detail ? (
        <Box
          position="absolute"
          sx={{ left: `calc(${x} + 22px)`, top: `calc(${y} - 26px)` }}
          bg={tokens.map}
          padding="10px 14px"
          borderRadius="2px"
          border={`1px solid ${tokens.rule}`}
          boxShadow="0 6px 20px rgba(14,17,22,0.12)"
          minW="220px"
        >
          <Text fontWeight={600} fontSize="14px">
            {label}
          </Text>
          <Text fontSize="12px" color={tokens.muted} mt="2px">
            Coverage{" "}
            <Box as="span" color={tokens.ink} fontWeight={600}>
              {detail.coverage}
            </Box>{" "}
            · {detail.facilities}
          </Text>
          <Text
            fontSize="11px"
            color={c}
            mt="6px"
            className="vax-mono"
            letterSpacing="0.08em"
          >
            ● {detail.alert}
          </Text>
        </Box>
      ) : (
        <Box
          position="absolute"
          sx={{ left: `calc(${x} + 16px)`, top: y }}
          bg={tokens.map}
          padding="5px 9px"
          borderRadius="2px"
          border={`1px solid ${tokens.rule}`}
          className="vax-mono"
          fontSize="10px"
          letterSpacing="0.08em"
          color={tokens.ink}
        >
          {label} · {sub}
        </Box>
      )}
    </>
  );
}

const Coverage = () => {
  return (
    <Box
      id="coverage"
      position="relative"
      overflow="hidden"
      bg={tokens.map}
      color={tokens.ink}
      py={{ base: "80px", md: "120px" }}
    >
      {/* Map backdrop */}
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <rect width="1600" height="900" fill={tokens.water} />
        <path
          d="M -60 200 Q 220 120 480 200 T 920 240 Q 1100 280 1280 220 T 1660 320 L 1660 700 Q 1480 760 1280 700 T 880 760 Q 580 800 320 740 T -60 640 Z"
          fill={tokens.land}
        />
        <path
          d="M 100 820 Q 320 880 640 840 T 1080 860 L 1140 900 L 40 900 Z"
          fill={tokens.land}
        />
        {Array.from({ length: 9 }).map((_, i) => (
          <path
            key={i}
            d={`M ${-60 + i * 6} ${320 + i * 28} Q ${360 + i * 4} ${260 + i * 26} ${
              760 + i * 2
            } ${320 + i * 28} T 1660 ${380 + i * 24}`}
            fill="none"
            stroke="rgba(14,17,22,0.07)"
            strokeWidth="1"
          />
        ))}
        {[200, 400, 600, 800, 1000, 1200, 1400].map((xv) => (
          <line key={xv} x1={xv} x2={xv} y1="0" y2="900" stroke="rgba(14,17,22,0.05)" />
        ))}
        {[180, 360, 540, 720].map((yv) => (
          <line key={yv} x1="0" x2="1600" y1={yv} y2={yv} stroke="rgba(14,17,22,0.05)" />
        ))}
        <path
          d="M 280 640 C 480 560, 720 540, 880 580 S 1180 480, 1380 400"
          fill="none"
          stroke={tokens.brand}
          strokeWidth="1.6"
          strokeDasharray="3 7"
        />
      </svg>

      {/* Compass / scale */}
      <Box
        position="absolute"
        top="32px"
        right={{ base: "20px", md: "40px" }}
        className="vax-mono"
        fontSize="10px"
        color={tokens.muted}
        letterSpacing="0.1em"
        textAlign="right"
        zIndex={2}
      >
        <Text mb="8px">N ↑ · 1:4,200,000</Text>
        <Box
          w="80px"
          h="4px"
          marginLeft="auto"
          sx={{
            background: `linear-gradient(to right, ${tokens.ink} 0 25%, ${tokens.map} 25% 50%, ${tokens.ink} 50% 75%, ${tokens.map} 75% 100%)`,
          }}
          border={`1px solid ${tokens.ink}`}
        />
        <Text mt="4px">0 — 100 km</Text>
      </Box>

      <Container
        maxW="container.xl"
        px={{ base: "20px", md: "32px" }}
        sx={{ position: "relative", zIndex: 2 }}
      >
        <Grid
          templateColumns={{ base: "1fr", md: "1.05fr 1fr" }}
          gap={{ base: "40px", md: "64px" }}
          alignItems="start"
        >
          {/* LEFT — overlay panel */}
          <GridItem>
            <Box
              bg="rgba(255,255,255,0.92)"
              sx={{ backdropFilter: "blur(8px)" }}
              border={`1px solid ${tokens.rule}`}
              padding={{ base: "28px", md: "40px 44px" }}
              borderRadius="2px"
              maxW="600px"
            >
              <Eyebrow color={tokens.alert}>Live coverage map · 14:22 UTC</Eyebrow>
              <Text
                as="h2"
                mt="20px"
                fontWeight={600}
                fontSize={{ base: "34px", md: "56px" }}
                lineHeight="1.0"
                letterSpacing="-0.03em"
              >
                See every facility,
                <br />
                every dose,
                <br />
                <Box as="span" color={tokens.alert}>
                  on one map.
                </Box>
              </Text>
              <Text
                mt="20px"
                fontSize={{ base: "15px", md: "16px" }}
                lineHeight="1.6"
                color={tokens.muted}
                maxW="460px"
              >
                Coverage rates, stock status, and cold-chain alerts plotted across every
                facility in your programme. Filter by country, vaccine type, and time
                period — and drill from country to clinic in a few clicks.
              </Text>

              <Flex gap="12px" mt="28px" flexWrap="wrap">
                <CTA variant="brand" href="/demo">
                  Explore the map →
                </CTA>
                <CTA variant="ghost" href="/impact">
                  See sample report
                </CTA>
              </Flex>

              <Box mt="32px" pt="20px" borderTop={`1px solid ${tokens.rule}`}>
                <Grid templateColumns="repeat(3, 1fr)" gap="20px">
                  {([
                    ["11", "Country programmes", tokens.brand],
                    ["1,240", "Facilities live", tokens.brand],
                    ["08", "Active alerts", tokens.alert],
                  ] as const).map(([v, l, c]) => (
                    <GridItem key={l}>
                      <Text
                        fontWeight={600}
                        fontSize="22px"
                        color={c}
                        className="vax-tabular"
                        letterSpacing="-0.015em"
                      >
                        {v}
                      </Text>
                      <Text
                        fontSize="11px"
                        color={tokens.muted}
                        mt="4px"
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                      >
                        {l}
                      </Text>
                    </GridItem>
                  ))}
                </Grid>
              </Box>
            </Box>
          </GridItem>

          {/* RIGHT — pins layer */}
          <GridItem display={{ base: "none", md: "block" }}>
            <Box position="relative" h="500px">
              <FacilityPin x="14%" y="22%" status="ok" label="NAIROBI-H44" sub="94.1%" />
              <FacilityPin
                x="44%"
                y="34%"
                status="alert"
                label="Kano State HQ"
                detail={{
                  coverage: "87.4%",
                  facilities: "12 facilities",
                  alert: "1 cold chain alert",
                }}
                big
              />
              <FacilityPin x="74%" y="14%" status="watch" label="KATHMANDU" sub="71.0%" />
              <FacilityPin x="22%" y="62%" status="ok" label="KISUMU-W2" sub="94.4%" />
              <FacilityPin x="62%" y="68%" status="ok" label="MAPUTO-S" sub="88.3%" />
              <FacilityPin x="84%" y="52%" status="watch" label="JUBA" sub="78.2%" />
              <FacilityPin x="36%" y="84%" status="ok" label="LUSAKA-N" sub="91.0%" />
            </Box>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default Coverage;
