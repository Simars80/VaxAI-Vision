"use client";

import { Box, Container, Grid, GridItem, Text, VStack } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { Fade, Slide } from "react-awesome-reveal";

interface MetricCardProps {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
  description: string;
  color: string;
}

const MetricCard = ({
  value,
  suffix,
  prefix = "",
  label,
  description,
  color,
}: MetricCardProps) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
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
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [hasStarted, value]);

  return (
    <Box
      ref={ref}
      bg="#1A1A1A"
      borderRadius="16px"
      p={{ base: "28px", md: "40px" }}
      border="1px solid #2D2D2D"
      _hover={{ borderColor: color, transition: "border-color 0.3s" }}
      transition="all 0.3s"
    >
      <VStack align="flex-start" spacing={3}>
        <Box w="40px" h="4px" bg={color} borderRadius="full" />
        <Text
          fontSize={{ base: "40px", md: "56px" }}
          fontWeight={800}
          color="#fff"
          lineHeight="1"
        >
          {prefix}
          {count.toLocaleString()}
          {suffix}
        </Text>
        <Text fontSize={{ base: "16px", md: "18px" }} fontWeight={700} color={color}>
          {label}
        </Text>
        <Text fontSize="14px" color="#718096" lineHeight="1.6">
          {description}
        </Text>
      </VStack>
    </Box>
  );
};

const metrics: MetricCardProps[] = [
  {
    value: 340,
    suffix: "+",
    label: "Healthcare Facilities Covered",
    description:
      "Public clinics, district hospitals, and primary care centres actively using VaxAI to manage cold-chain inventory.",
    color: "#3A5BCC",
  },
  {
    value: 1200000,
    suffix: "+",
    label: "Vaccine Doses Tracked",
    description:
      "Individual vaccine units logged and verified in real time — eliminating phantom stock and expiry-driven waste.",
    color: "#F56630",
  },
  {
    value: 63,
    suffix: "%",
    label: "Stockout Reduction",
    description:
      "Facilities on VaxAI have cut stockout events by over 63% compared to pre-deployment baselines.",
    color: "#48BB78",
  },
];

const ImpactMetrics = () => {
  return (
    <Box bg="#0F0F0F" py={{ base: "64px", md: "112px" }}>
      <Container maxW="container.xl">
        <Slide direction="up" triggerOnce>
          <VStack spacing={4} mb={{ base: "48px", md: "72px" }} align="center" textAlign="center">
            <Text
              color="#3A5BCC"
              fontSize="14px"
              fontWeight={600}
              textTransform="uppercase"
              letterSpacing="2px"
            >
              Impact by the Numbers
            </Text>
            <Text
              color="#fff"
              fontSize={{ base: "28px", md: "44px" }}
              fontWeight={800}
              maxW="700px"
              lineHeight="1.2"
            >
              Measurable outcomes across every deployment
            </Text>
            <Text color="#718096" fontSize={{ base: "15px", md: "18px" }} maxW="580px">
              Every metric below is drawn from live facility data across our
              pilot regions in West Africa.
            </Text>
          </VStack>
        </Slide>

        <Grid
          templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap={{ base: "20px", md: "28px" }}
        >
          {metrics.map((metric, idx) => (
            <Fade key={idx} triggerOnce delay={idx * 150}>
              <MetricCard {...metric} />
            </Fade>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default ImpactMetrics;
