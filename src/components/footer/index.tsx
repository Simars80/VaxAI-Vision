"use client";

import { Box, Container, Text } from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaLinkedin } from "react-icons/fa6";
import { MdEmail } from "react-icons/md";

const Footer = () => {
  const pathname = usePathname();

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

  const social: { icon: React.ReactNode; link: string; label: string }[] = [
    {
      icon: <FaLinkedin color={"#fff"} />,
      link: "https://www.linkedin.com/company/vaxai-vision/",
      label: "LinkedIn",
    },
    {
      icon: <MdEmail color={"#fff"} />,
      link: "mailto:partnerships@vaxaivision.com",
      label: "Email",
    },
  ];
  return (
    <Box bg="#1A1A1A" py="17px" display={{ base: "none", md: "block" }} mt='365px'>
      <Container maxW="container.xl">
        <Box
          display={"flex"}
          justifyContent={"space-between"}
          alignItems={"center"}
        >
          <Box display={"flex"} gap="56px" alignItems={"center"}>
            <Text color="#fff" fontSize={"16px"} fontWeight={400}>
              Quick links:
            </Text>

            <Box
              bg="#292424"
              borderRadius={"40px"}
              display={"flex"}
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
          </Box>

          <Box display='flex' flexDir={'column'}>
            <Box display={"flex"} alignItems={"center"} gap="32px">
              <Text color="#FFFFFF" fontSize={"16px"} fontWeight={700}>
                Contact Us
              </Text>

              <Box display={"flex"} gap="13px" alignItems={"center"}>
                {social.map((data, idx) => {
                  const isExternal = data.link.startsWith("http");
                  return (
                    <a
                      key={idx}
                      href={data.link}
                      aria-label={data.label}
                      {...(isExternal
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      <Box
                        w="28px"
                        h="28px"
                        bg="#898989"
                        borderRadius={"full"}
                        display={"grid"}
                        placeItems={"center"}
                      >
                        {data.icon}
                      </Box>
                    </a>
                  );
                })}
              </Box>
            </Box>

            <Text color='white' w='319px' fontSize={'16px'} fontWeight={700} mt='8px'>
              Address : 254 Chapman Rd, Ste 208 Newark, Delaware, 19702
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
