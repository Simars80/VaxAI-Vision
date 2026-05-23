"use client";

import { Box, Text, Center } from "@chakra-ui/react";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import close from "@/assets/close.png";
import { FaLinkedin } from "react-icons/fa6";
import { MdEmail } from "react-icons/md";
import { tokens } from "@/components/home/_tokens";

const Mobile = ({
  onClose,
  routes,
  pathname,
}: {
  onClose: () => void;
  routes: { name: string; path: string }[];
  pathname: string | null;
}) => {
  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <Box py="22px" px="20px" h="100%" display="flex" flexDir="column">
      <Box display="flex" justifyContent="flex-end">
        <Box onClick={onClose} cursor="pointer">
          <Image src={close} alt="close icon" />
        </Box>
      </Box>

      <Box display="flex" flexDir="column" gap="20px" mt="32px" flex="1">
        {routes.map((data, idx) => {
          const active = isActive(data.path);
          return (
            <Link
              key={idx}
              href={data.path}
              onClick={onClose}
              style={{
                color: active ? "#fff" : "rgba(255,255,255,0.85)",
                fontSize: 20,
                fontWeight: active ? 700 : 600,
                letterSpacing: "-0.01em",
                textDecoration: active ? "underline" : "none",
                textUnderlineOffset: 6,
                textDecorationThickness: 2,
              }}
            >
              {data.name}
            </Link>
          );
        })}

        <Link
          href="/waitlist"
          onClick={onClose}
          style={{
            marginTop: 20,
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "14px 22px",
            background: "#fff",
            color: tokens.brand,
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 6,
          }}
        >
          Request access →
        </Link>
      </Box>

      <Box pt="20px" borderTop="1px solid rgba(255,255,255,0.18)">
        <Text color="#fff" fontSize="13px" fontWeight={500} mb="12px" letterSpacing="0.02em">
          Stay in touch
        </Text>
        <Center justifyContent="flex-start" gap="14px">
          <a
            href="https://www.linkedin.com/company/vaxai-vision/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="VaxAI Vision on LinkedIn"
          >
            <Box
              w="36px"
              h="36px"
              bg="rgba(255,255,255,0.15)"
              borderRadius="999px"
              display="grid"
              placeItems="center"
            >
              <FaLinkedin color="#fff" size={16} />
            </Box>
          </a>
          <a href="mailto:partnerships@vaxaivision.com" aria-label="Email">
            <Box
              w="36px"
              h="36px"
              bg="rgba(255,255,255,0.15)"
              borderRadius="999px"
              display="grid"
              placeItems="center"
            >
              <MdEmail color="#fff" size={18} />
            </Box>
          </a>
        </Center>
      </Box>
    </Box>
  );
};

export default Mobile;
