"use client";

import {
  Box,
  Button,
  Container,
  Grid,
  GridItem,
  Text,
  Image,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";

const Hero = () => {
  const [show, setShow] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const text = [
    ` Welcome to VaxAI, the leader in advanced solutions for
    efficient vaccine distribution and inventory management.`,
    `
    Our AI technology ensures accurate real-time tracking and verification, optimizing distribution and minimizing waste for
    healthcare facilities and government agencies.
    `,
  ];

  useEffect(() => {
    const intervalId = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % text.length);
        setShow(true);
      }, 500);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [text.length]);
  return (
    <>
      <Box
        bg={{ base: "#1E1E1EB2", md: "#FBFBFB" }}
        position={"relative"}
        zIndex={5}
      >
        <Image
          src={
            "https://res.cloudinary.com/alonexx/image/upload/v1721987954/Group_1000003533_1_kvghhv.png"
          }
          display={{ base: "block", md: "none" }}
          alt="img"
          opacity={0.4}
          position={"absolute"}
          bottom={0}
          zIndex={-10}
        />
        <Container maxW="container.xl">
          <Grid
            templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
            gap="129px"
          >
            <GridItem py={{ base: "40px", md: "136px" }}>
              <Slide direction="left">
                <Text
                  color={{ base: "#fff", md: "#1A1A1A" }}
                  fontSize={{ base: "24px", md: "48px" }}
                  fontWeight={700}
                  textAlign={{ base: "center", md: "left" }}
                >
                  Redefining Vaccine Management
                </Text>
              </Slide>
              <Box display={{base: 'none', md:'block'}}>
              <Slide direction="left" duration={2000}>
                <Text
                  mt="20px"
                  fontSize={{ base: "16px", md: "18px" }}
                  fontWeight={400}
                  color={{ base: "#fff", md: "#667085" }}
                  textAlign={{ base: "center", md: "left" }}
                >
                  Welcome to VaxAI, the leader in advanced solutions for
                  efficient vaccine distribution and inventory management. Our
                  AI technology ensures accurate real-time tracking and
                  verification, optimizing distribution and minimizing waste for
                  healthcare facilities and government agencies.
                </Text>
              </Slide>
              </Box>
              <Box display={{base:'block', md:'none'}}>
              <Text
                  textAlign={"center"}
                  mt="20px"
                  color={'#fff'}
                  fontSize={{ base: "16px", md: "18px" }}
                  opacity={show ? 1 : 0}
                  transition={"opacity 0.5s ease-in-out"}
                >
                  {text[currentIndex]}
                </Text>
              </Box>
            

              <Slide direction="left">
                <Box
                  display={"flex"}
                  justifyContent={{ base: "center", md: "flex-start" }}
                >
                  <Link href={"#solutions"}>
                    <Button
                      mt="32px"
                      fontSize={{base: '12px', md: "16px"}}
                      fontWeight={600}
                      color="#fff"
                      bg="#3A5BCC"
                      h={{base: '45px', md: "55px"}}
                      borderRadius={"10px"}
                      _hover={{
                        opacity: 0.8,
                      }}
                    >
                      Start your Journey
                    </Button>
                  </Link>
                </Box>
              </Slide>
            </GridItem>

            <GridItem display={{ base: "none", md: "block" }}>
              <Box position={"absolute"} bottom={0} right={10}>
                <Slide direction="right">
                  <Image
                    src={
                      "https://res.cloudinary.com/alonexx/image/upload/v1721987954/Group_1000003533_1_kvghhv.png"
                    }
                    alt="hero"
                    height={604}
                    width={793}
                    loading="lazy"
                  />
                </Slide>
              </Box>
            </GridItem>
          </Grid>
        </Container>
      </Box>
    </>
  );
};

export default Hero;
