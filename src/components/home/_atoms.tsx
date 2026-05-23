"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import React from "react";
import { tokens } from "./_tokens";

/* --------------------------------------------------------------- Eyebrow */
export function Eyebrow({
  children,
  color,
  dash = true,
}: {
  children: React.ReactNode;
  color?: string;
  dash?: boolean;
}) {
  const c = color || tokens.brand;
  return (
    <Flex
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="12px"
      fontSize="11px"
      letterSpacing="0.22em"
      textTransform="uppercase"
      fontWeight={500}
      color={c}
    >
      {dash && <Box as="span" w="18px" h="1px" bg={c} />}
      <Box as="span">{children}</Box>
    </Flex>
  );
}

/* ----------------------------------------------------------------- CTA */
type CTAVariant = "solid" | "ghost" | "brand";

export function CTA({
  children,
  variant = "solid",
  size = "md",
  href,
  onClick,
}: {
  children: React.ReactNode;
  variant?: CTAVariant;
  size?: "md" | "lg";
  href?: string;
  onClick?: () => void;
}) {
  const big = size === "lg";

  const stylesByVariant: Record<CTAVariant, React.CSSProperties> = {
    solid: { background: tokens.ink, color: "#fff", border: "none" },
    ghost: {
      background: "transparent",
      color: tokens.ink,
      border: `1px solid ${tokens.rule}`,
    },
    brand: {
      background: tokens.brand,
      color: "#fff",
      border: "none",
      boxShadow: "0 4px 14px rgba(58,91,204,0.22)",
    },
  };

  const style: React.CSSProperties = {
    ...stylesByVariant[variant],
    fontFamily: "inherit",
    fontWeight: 500,
    fontSize: big ? 15 : 14,
    padding: big ? "15px 26px" : "12px 22px",
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    lineHeight: 1.2,
    transition: "transform 0.15s ease, background 0.15s ease, opacity 0.15s ease",
  };

  if (href) {
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} style={style}>
      {children}
    </button>
  );
}

/* --------------------------------------------------------- Placeholder */
export function Placeholder({
  w,
  h,
  color,
  children,
}: {
  w?: string;
  h?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const c = color || tokens.ink;
  return (
    <Box
      w={w}
      h={h}
      color={c}
      bg="transparent"
      sx={{
        backgroundImage: `repeating-linear-gradient(135deg, ${c}10 0 1px, transparent 1px 10px)`,
      }}
      border={`1px dashed ${c}40`}
      borderRadius="4px"
      display="flex"
      alignItems="center"
      justifyContent="center"
      className="vax-mono"
      fontSize="11px"
      letterSpacing="0.14em"
      textTransform="uppercase"
      opacity={0.85}
    >
      <Text
        as="span"
        px="10px"
        py="4px"
        bg={`${c}10`}
        color={c}
        borderRadius="2px"
      >
        {children}
      </Text>
    </Box>
  );
}

/* ----------------------------------------------------------------- Logo */
export function Logo({ inverted = false, size = 22 }: { inverted?: boolean; size?: number }) {
  const labelColor = inverted ? "#fff" : tokens.ink;
  return (
    <Flex display="inline-flex" alignItems="center" gap="10px">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="3" fill={tokens.brand} />
        <rect x="6" y="6" width="12" height="12" rx="1.5" fill={inverted ? tokens.navBg : "#fff"} />
        <path
          d="M8 10 L12 16 L16 10"
          stroke={tokens.brand}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <Text as="span" fontWeight={600} fontSize="16px" letterSpacing="-0.01em" color={labelColor}>
        VaxAI&nbsp;Vision
      </Text>
    </Flex>
  );
}
