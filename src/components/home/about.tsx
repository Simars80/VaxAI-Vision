"use client";

import {
  Box,
  Button,
  Center,
  Container,
  Grid,
  GridItem,
  Image,
  Progress,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Slide } from "react-awesome-reveal";
import ProgressBar from "@/components/progressbar";

const AboutComponent = () => {
  const pathname = usePathname();

  const progress = [
    {
      title: "Cutting-edge technology",
      value: 95,
    },
    {
      title: "Data-driven analytics",
      value: 95,
    },
    {
      title: "Dedicated healthcare experts",
      value: 95,
    },
    {
      title: "Innovative solutions",
      value: 95,
    },
  ];
  return (
    <Box bg="#1A1A1A" py={{ base: "68px", md: "132px" }}>
      <Container maxW="container.xl">
        <Grid
          templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
          gap={{ base: "40px", md: "65px" }}
          alignItems={{ base: "none", md: "center" }}
        >
          <GridItem>
            <Slide direction="left" duration={1000}>
              <Image
                src="https://res.cloudinary.com/alonexx/image/upload/v1721987390/image_1_1_hpjrkx.png"
                alt="stock"
                objectFit={"cover"}
              />
            </Slide>
          </GridItem>

          <GridItem>
            <Slide direction="right" duration={1500}>
           
              <Text
                color="#fff"
                fontSize={{ base: "24px", md: "42px" }}
                fontWeight={700}
              >
                    About Us
              </Text>
              <Box display={"flex"} flexDir={"column"} gap="17px" mt="25px">
                {progress.map((data, idx) => (
                  <Box key={idx}>
                    <Text
                      color="#E4DBDB"
                      fontSize={"18px"}
                      fontWeight={400}
                      mb="7px"
                    >
                      {data.title}
                    </Text>
                    <ProgressBar percentage={data.value} />
                  </Box>
                ))}
              </Box>
            </Slide>
          </GridItem>
        </Grid>

        <Grid
          templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
          gap={{ base: "27px", md: "65px" }}
          mt="39px"
        >
          <Slide cascade direction="left" triggerOnce>
            <GridItem>
              <Text
                fontSize={{ base: "20px", md: "24px" }}
                fontWeight={700}
                mb="18px"
                color={"#fff"}
              >
                Mission Statement
              </Text>

              <Text fontSize={"16px"} fontWeight={400} color="#E4DBDB">
                At VaxAI Vision, our mission is to revolutionize vaccine
                management by leveraging cutting-edge AI technology to
                streamline vaccine distribution, minimize waste, and enhance the
                overall efficiency of public health initiatives. At VaxAI
                Vision, our mission is to revolutionize vaccine management by
                leveraging cutting-edge AI technology to streamline vaccine
                distribution, minimize waste, and enhance the overall efficiency
                of public health initiatives. We are dedicated to providing
                real-time data analytics and stock verification solutions that
                empower healthcare providers and government agencies to make
                informed decisions, ensuring that vaccines and related supplies
                are readily available and effectively utilized to improve health
                outcomes worldwide.
              </Text>
            </GridItem>
          </Slide>

          <Slide cascade direction="right" triggerOnce>
            <GridItem>
              <Text
                fontSize={{ base: "20px", md: "24px" }}
                fontWeight={700}
                mb="18px"
                color="#fff"
              >
                Vision Statement
              </Text>

              <Text fontSize={"16px"} fontWeight={400} color="#E4DBDB">
                VaxAI Vision envisions a future where advanced technology
                transforms vaccine management systems globally, creating a world
                where every community has timely access to life-saving vaccines.
                By driving innovation and fostering partnerships, we aim to set
                new standards in public health logistics, enhancing the
                resilience and responsiveness of healthcare systems to meet the
                challenges of today and tomorrow.
              </Text>
            </GridItem>
          </Slide>
        </Grid>

        {pathname !== "/about" && (
          <Center>
            <Link href="about">
              <Button
                bg="#3A5BCC"
                h="50px"
                borderRadius={"10px"}
                mt="32px"
                color="#fff"
                fontSize={"16px"}
                fontWeight={400}
                _hover={{
                  opacity: 0.8,
                }}
              >
                Learn More
              </Button>
            </Link>
          </Center>
        )}
      </Container>
    </Box>
  );
};

export default AboutComponent;
