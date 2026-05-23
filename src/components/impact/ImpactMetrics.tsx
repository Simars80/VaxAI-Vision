"use client";

import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

const CountUp = ({ value, suffix, prefix = "" }: { value: number; suffix?: string; prefix?: string }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) setHasStarted(true);
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let start = 0;
    const duration = 1800;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [hasStarted, value]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
};

const metrics = [
  {
    value: 340, suffix: "+", color: tokens.brand,
    label: "Facilities covered",
    description:
      "Public clinics, district hospitals, and primary care centres actively using VaxAI to manage cold-chain inventory.",
  },
  {
    value: 1200000, suffix: "+", color: tokens.brand,
    label: "Vaccine doses tracked",
    description:
      "Individual vaccine units logged and verified in real time — eliminating phantom stock and expiry-driven waste.",
  },
  {
    value: 63, suffix: "%", color: tokens.ok,
    label: "Stockout reduction",
    description:
      "Facilities on VaxAI have cut stockout events by over 63% compared to pre-deployment baselines.",
  },
];

const ImpactMetrics = () => {
  return (
    <Box bg={tokens.navBg} color="#fff" py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="32px" alignItems="end" mb={{ base: "40px", md: "56px" }}>
          <GridItem>
            <Eyebrow color="#9aa6cf">Impact by the numbers</Eyebrow>
            <Text as="h2" mt="14px" fontWeight={600}
                  fontSize={{ base: "30px", md: "44px" }}
                  lineHeight="1.05" letterSpacing="-0.03em" color="#fff">
              Measurable outcomes across every deployment.
            </Text>
          </GridItem>
          <GridItem>
            <Text fontSize="15px" lineHeight="1.65" color="rgba(255,255,255,0.6)" maxW="500px">
              Every metric below is drawn from live facility data across our pilot regions in West Africa.
              Programme-level breakdowns available to partners on request.
            </Text>
          </GridItem>
        </Grid>

        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="0"
              borderTop="1px solid rgba(255,255,255,0.12)"
              borderBottom="1px solid rgba(255,255,255,0.12)">
          {metrics.map((m, i, arr) => (
            <GridItem key={m.label}
              padding={{ base: "32px 8px", md: "44px 32px" }}
              borderRight={{ base: "none", md: i === arr.length - 1 ? "none" : "1px solid rgba(255,255,255,0.12)" }}
              borderBottom={{ base: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.12)" : "none", md: "none" }}>
              <Box w="40px" h="3px" bg={m.color} mb="20px" />
              <Text fontWeight={600} fontSize={{ base: "42px", md: "56px" }}
                    lineHeight="1.0" letterSpacing="-0.025em"
                    color="#fff" className="vax-tabular" mb="14px">
                <CountUp value={m.value} suffix={m.suffix} />
              </Text>
              <Text fontSize="15px" fontWeight={600} color={m.color} mb="10px">
                {m.label}
              </Text>
              <Text fontSize="13px" color="rgba(255,255,255,0.6)" lineHeight="1.6">
                {m.description}
              </Text>
            </GridItem>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ImpactMetrics;
