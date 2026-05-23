"use client";

import { Box, Button, Container, Flex } from "@chakra-ui/react";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IoMenu } from "react-icons/io5";
import SideModal from "@/components/sideModal";
import Mobile from "@/components/navbar/mobile";
import { tokens } from "@/components/home/_tokens";

const Navbar = () => {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const links = [
    { name: "Platform", path: "/#solutions" },
    { name: "Solutions", path: "/solutions" },
    { name: "Impact", path: "/impact" },
    { name: "Blog", path: "/blog" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
    { name: "Live Demo", path: "/demo" },
  ];

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname?.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      <SideModal isOpen={show} onClose={() => setShow(!show)}>
        <Mobile onClose={() => setShow(!show)} routes={links} pathname={pathname} />
      </SideModal>

      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={20}
        bg={tokens.navBg}
        borderBottom="1px solid rgba(255,255,255,0.06)"
      >
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Flex alignItems="center" justifyContent="space-between" py={{ base: "16px", md: "18px" }}>
            {/* Logo */}
            <Link href="/" aria-label="VaxAI Vision home">
              <Box display="flex" alignItems="center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src={require("@/assets/logo_light.png")}
                  alt="VaxAI Vision"
                  height={42}
                  style={{ height: 42, width: "auto" }}
                />
              </Box>
            </Link>

            {/* Desktop pill nav */}
            <Box
              display={{ base: "none", lg: "flex" }}
              bg={tokens.navPill}
              borderRadius="999px"
              padding="6px"
              alignItems="center"
              gap="2px"
            >
              {links.map((d) => {
                const active = isActive(d.path);
                return (
                  <Link
                    key={d.name}
                    href={d.path}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 500,
                      color: active ? tokens.brand : tokens.navMuted,
                      background: active ? "#fff" : "transparent",
                      transition: "color 0.15s ease, background 0.15s ease",
                    }}
                  >
                    {d.name}
                  </Link>
                );
              })}
            </Box>

            {/* Right cluster */}
            <Flex alignItems="center" gap="10px">
              <Link
                href="/contact"
                style={{
                  color: tokens.navMuted,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 12px",
                  display: "none",
                }}
                className="vax-hide-mobile-link"
              >
                Sign in
              </Link>

              <Box display={{ base: "none", md: "block" }}>
                <Link href="/waitlist">
                  <Button
                    bg={tokens.brand}
                    color="#fff"
                    h="44px"
                    px="18px"
                    borderRadius="6px"
                    fontSize="13px"
                    fontWeight={600}
                    _hover={{ bg: tokens.brandHover }}
                    boxShadow="0 4px 14px rgba(58,91,204,0.22)"
                  >
                    Request access →
                  </Button>
                </Link>
              </Box>

              <Box
                display={{ base: "block", lg: "none" }}
                bg="rgba(255,255,255,0.08)"
                borderRadius="6px"
                onClick={() => setShow(!show)}
                py="10px"
                px="10px"
                color="#fff"
                cursor="pointer"
                aria-label="Open menu"
              >
                <IoMenu size={22} />
              </Box>
            </Flex>
          </Flex>
        </Container>
      </Box>
    </>
  );
};

export default Navbar;
