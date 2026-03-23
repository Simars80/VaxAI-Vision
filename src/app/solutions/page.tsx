import Layout from "@/components/layout";
import { solutions } from "@/utils/enums";
import {
  Box,
  Center,
  Container,
  Grid,
  GridItem,
  Text,
  Button,
} from "@chakra-ui/react";
import React from "react";
import Link from "next/link";
import Image from "next/image";

const Solutions = () => {
  return (
    <Layout>
      <Box bg="#FBFBFB" py={{ base: "37px", md: "55px" }}>
        <Container maxW="container.xl">
          <Center>
            <Text
              fontSize={{ base: "16px", md: "40px" }}
              fontWeight={700}
              textAlign={"center"}
              color="#1A1A1A"
            >
              Comprehensive Vaccine Management
            </Text>
          </Center>
        </Container>
      </Box>

      <Box
        mt={{ base: "32px", md: "141px" }}
        mb={{ base: "40px", md: "373px" }}
      >
        <Container maxW="container.xl">
          <Text
            mb={{ base: "32px", md: "55px" }}
            fontSize={{ base: "18px", md: "40px" }}
            fontWeight={{ base: 700, md: 600 }}
            color="#1A1A1A"
            textAlign={"center"}
          >
            Our Solutions
          </Text>
          <Grid
            templateColumns={{ base: "auto", md: "repeat(3,1fr)" }}
            gap={{ base: "24px", md: "45px" }}
          >
            {solutions.map((data, idx) => (
              <GridItem key={idx}>
                <Box
                  borderRadius={"10px"}
                  border="1px solid #DEE5ED"
                  bg="#fff"
                  p="24px"
                >
                  <Image
                    src={data?.icon as any}
                    alt={data.title}
                    style={{
                      width: "40px",
                      height: "40px",
                      objectFit: "contain",
                    }}
                  />
                  <Text
                    mb="20px"
                    fontSize={"14px"}
                    fontWeight={700}
                    color="#1A1A1A"
                    mt="9px"
                  >
                    {data.title}
                  </Text>
                  <Text
                    color="#667085"
                    fontSize={"14px"}
                    fontWeight={400}
                    noOfLines={4}
                  >
                    {data.description}
                  </Text>

                  <Link href={`/solutions/${data.slug}`}>
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
                </Box>
              </GridItem>
            ))}
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
};

export default Solutions;
