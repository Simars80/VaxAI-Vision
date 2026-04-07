"use client";

import { Box, Container, Grid, GridItem, Text, VStack, Badge } from "@chakra-ui/react";
import React from "react";
import { Fade, Slide } from "react-awesome-reveal";

interface CountryPin {
  name: string;
  cx: number;
  cy: number;
  status: "active" | "pilot" | "planned";
  facilities: number;
}

const countries: CountryPin[] = [
  { name: "Nigeria", cx: 175, cy: 230, status: "active", facilities: 120 },
  { name: "Ghana", cx: 148, cy: 240, status: "active", facilities: 85 },
  { name: "Senegal", cx: 118, cy: 195, status: "active", facilities: 60 },
  { name: "Kenya", cx: 268, cy: 265, status: "pilot", facilities: 40 },
  { name: "Tanzania", cx: 265, cy: 295, status: "pilot", facilities: 25 },
  { name: "Ethiopia", cx: 285, cy: 235, status: "pilot", facilities: 10 },
  { name: "Côte d'Ivoire", cx: 150, cy: 248, status: "active", facilities: 45 },
  { name: "Cameroon", cx: 200, cy: 255, status: "planned", facilities: 0 },
  { name: "Uganda", cx: 255, cy: 265, status: "planned", facilities: 0 },
  { name: "Rwanda", cx: 248, cy: 278, status: "planned", facilities: 0 },
];

const statusColors: Record<string, string> = {
  active: "#3A5BCC",
  pilot: "#F56630",
  planned: "#4A5568",
};

const statusLabels: Record<string, string> = {
  active: "Active Deployment",
  pilot: "Pilot Phase",
  planned: "Planned 2025",
};

const AfricaSVG = () => (
  <svg
    viewBox="0 0 420 520"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: "480px", height: "auto" }}
  >
    {/* Africa continent simplified outline */}
    <path
      d="M160 30
         C170 28, 185 25, 195 28
         C215 30, 230 32, 250 35
         C270 38, 285 42, 295 50
         C310 60, 315 72, 318 85
         C322 100, 320 115, 318 128
         C316 140, 320 152, 322 162
         C325 175, 326 185, 322 196
         C318 208, 310 216, 305 225
         C300 235, 298 242, 296 252
         C294 265, 295 278, 294 290
         C293 305, 290 318, 284 330
         C275 345, 262 355, 250 368
         C238 380, 230 392, 225 405
         C220 416, 218 425, 215 435
         C212 445, 208 455, 205 462
         C202 468, 198 472, 193 475
         C186 478, 178 475, 172 470
         C165 465, 160 458, 156 450
         C150 440, 146 428, 140 418
         C133 406, 125 395, 118 382
         C110 368, 104 352, 98 338
         C91 322, 86 306, 82 290
         C78 274, 76 258, 74 242
         C72 226, 72 210, 70 195
         C68 180, 64 166, 62 152
         C58 135, 55 118, 54 102
         C52 86, 54 70, 60 58
         C66 46, 78 38, 92 33
         C108 28, 130 28, 145 28
         Z"
      fill="#1E2533"
      stroke="#2D3748"
      strokeWidth="1.5"
    />

    {/* Grid lines subtle */}
    {[100, 150, 200, 250, 300, 350, 400].map((y) => (
      <line key={`h${y}`} x1="40" y1={y} x2="380" y2={y} stroke="#ffffff06" strokeWidth="0.5" />
    ))}
    {[80, 130, 180, 230, 280, 330].map((x) => (
      <line key={`v${x}`} x1={x} y1="20" x2={x} y2="500" stroke="#ffffff06" strokeWidth="0.5" />
    ))}

    {/* Country pins */}
    {countries.map((c) => (
      <g key={c.name}>
        {/* Pulse ring for active */}
        {c.status === "active" && (
          <circle cx={c.cx} cy={c.cy} r="14" fill={statusColors[c.status]} opacity="0.15" />
        )}
        <circle
          cx={c.cx}
          cy={c.cy}
          r="7"
          fill={statusColors[c.status]}
          opacity={c.status === "planned" ? 0.4 : 0.9}
        />
        {c.status !== "planned" && (
          <circle cx={c.cx} cy={c.cy} r="3" fill="#fff" opacity="0.9" />
        )}
        {/* Label */}
        <text
          x={c.cx + 10}
          y={c.cy + 4}
          fill="#E2E8F0"
          fontSize="9"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          opacity={c.status === "planned" ? 0.4 : 0.85}
        >
          {c.name}
        </text>
      </g>
    ))}
  </svg>
);

const coverageStats = [
  { label: "Countries with active deployments", value: "4" },
  { label: "Countries in pilot phase", value: "3" },
  { label: "Countries planned by end of 2025", value: "3" },
  { label: "Total facilities on the platform", value: "340+" },
];

const CoverageMap = () => {
  return (
    <Box id="coverage" bg="#141414" py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl">
        <Slide direction="up" triggerOnce>
          <VStack spacing={4} mb={{ base: "48px", md: "72px" }} align="center" textAlign="center">
            <Text
              color="#F56630"
              fontSize="14px"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing="2px"
            >
              Geospatial Coverage
            </Text>
            <Text
              color="#fff"
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight={800}
              maxW="700px"
              lineHeight="1.2"
            >
              10 countries. One platform. Growing fast.
            </Text>
          </VStack>
        </Slide>

        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={{ base: "40px", md: "80px" }}
          alignItems="center"
        >
          <Fade triggerOnce>
            <Box display="flex" justifyContent="center">
              <AfricaSVG />
            </Box>
          </Fade>

          <GridItem>
            <Slide direction="right" triggerOnce duration={900}>
              {/* Legend */}
              <VStack align="flex-start" spacing={4} mb="40px">
                {Object.entries(statusLabels).map(([key, label]) => (
                  <Box key={key} display="flex" alignItems="center" gap="12px">
                    <Box
                      w="14px"
                      h="14px"
                      borderRadius="full"
                      bg={statusColors[key]}
                      opacity={key === "planned" ? 0.4 : 1}
                      flexShrink={0}
                    />
                    <Text color="#CBD5E0" fontSize="15px" fontWeight={500}>
                      {label}
                    </Text>
                  </Box>
                ))}
              </VStack>

              {/* Stats grid */}
              <Grid templateColumns="repeat(2, 1fr)" gap="16px">
                {coverageStats.map((s, idx) => (
                  <Fade key={idx} triggerOnce delay={idx * 100}>
                    <Box
                      bg="#1A1A1A"
                      borderRadius="12px"
                      p="20px"
                      border="1px solid #2D2D2D"
                    >
                      <Text
                        color="#fff"
                        fontSize={{ base: "24px", md: "32px" }}
                        fontWeight={800}
                        mb="4px"
                      >
                        {s.value}
                      </Text>
                      <Text color="#718096" fontSize="13px" lineHeight="1.5">
                        {s.label}
                      </Text>
                    </Box>
                  </Fade>
                ))}
              </Grid>

              {/* Countries list */}
              <Box mt="32px">
                <Text color="#718096" fontSize="13px" mb="12px" fontWeight={600} textTransform="uppercase" letterSpacing="1px">
                  Active Countries
                </Text>
                <Box display="flex" flexWrap="wrap" gap="8px">
                  {countries
                    .filter((c) => c.status !== "planned")
                    .map((c) => (
                      <Badge
                        key={c.name}
                        bg={c.status === "active" ? "#3A5BCC22" : "#F5663022"}
                        color={c.status === "active" ? "#3A5BCC" : "#F56630"}
                        border="1px solid"
                        borderColor={c.status === "active" ? "#3A5BCC44" : "#F5663044"}
                        borderRadius="full"
                        px="12px"
                        py="4px"
                        fontSize="12px"
                        fontWeight={600}
                      >
                        {c.name}
                        {c.facilities > 0 ? ` · ${c.facilities}` : ""}
                      </Badge>
                    ))}
                </Box>
              </Box>
            </Slide>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default CoverageMap;
