"use client";

import { Box, Button, Container, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IoMenu } from "react-icons/io5";
import SideModal from "@/components/sideModal";
import Mobile from "@/components/navbar/mobile";
import Image from "next/image";

const Navbar = () => {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const link = [
    {
      name: "Home",
      path: "/",
    },
    {
      name: "Solutions",
      path: "/solutions",
    },
    {
      name: "About Us",
      path: "/about",
    },
    {
      name: "Blog",
      path: "/blog",
    },
    {
      name: "Contact",
      path: "/contact",
    },
    {
      name: "Impact",
      path: "/impact",
    },
    {
      name: "Live Demo",
      path: "/demo",
    },
  ];

  return (
    <>
      <SideModal isOpen={show} onClose={() => setShow(!show)}>
        <Mobile
          onClose={() => setShow(!show)}
          routes={link}
          pathname={pathname}
        />
      </SideModal>

      <Box
        bg={{ base: "#fff", md: "#1A1A1A" }}
        py={{ base: "30px", md: "17px" }}
        position={"fixed"}
        top={0}
        w="full"
        zIndex={10}
      >
        <Container maxW="container.xl">
          <Box
            display={"flex"}
            alignItems={"center"}
            justifyContent={"space-between"}
          >
            <Link href="/">
              <Box display={{ base: "none", md: "block" }}>
                <Image
                  src={require("@/assets/logo_light.png")}
                  alt="vax ai"
                  height="71"
                />
              </Box>
              <Box display={{ base: "block", md: "none" }}>
                <Image
                  src={require("@/assets/logo_dark.png")}
                  alt="vax ai"
                  height="60"
                />
              </Box>
            </Link>

            <Box
              bg="#292424"
              borderRadius={"40px"}
              display={{ base: "none", md: "flex" }}
              alignItems={"center"}
              gap="32px"
              py="16px"
              px="40px"
            >
              {link.map((data, idx) => (
                <Link
                  key={idx}
                  href={data.path}
                  style={{
                    color:
                      pathname === data.path
                        ? "#F56630"
                        : pathname.includes("blog") &&
                          data.path.includes("blog")
                        ? "#F56630"
                        : pathname.includes("solutions") &&
                          data.path.includes("solutions")
                        ? "#F56630"
                        : "#fff",
                    fontSize: "16px",
                    fontWeight: "600",
                  }}
                >
                  {data.name}
                </Link>
              ))}
            </Box>

            <Box
              display={{ base: "block", md: "none" }}
              bg="#0000000D"
              borderRadius={"3px"}
              onClick={() => setShow(!show)}
              py="10px"
              px="6px"
            >
              <IoMenu size={25} />
            </Box>

            <Box display={{ base: "none", md: "block" }}>
              <Link href="/waitlist">
                <Button
                  borderRadius={"10px"}
                  bg="#3A5BCC"
                  color="#fff"
                  py="16px"
                  h="55px"
                  fontSize={"16px"}
                  fontWeight={600}
                  _hover={{
                    opacity: 0.8,
                  }}
                >
                  Join our waitlist
                </Button>
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default Navbar;
