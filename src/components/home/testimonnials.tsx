"use client";

import { Avatar, Box, Center, Container, Text } from "@chakra-ui/react";
import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { Pagination } from "swiper/modules";

const Testimonnials = () => {
  return (
    <Box bg="#1A1A1A" py={{ base: "41px", md: "122px" }}>
      <Container maxW="container.xl">
        <Center>
          <Text
            fontSize={{ base: "20px", md: "42px" }}
            fontWeight={700}
            color="#fff"
            textAlign={"center"}
            mb="8px"
            w={{ base: "auto", md: "1100px" }}
            display={{ base: "none", md: "block" }}
          >
          Our Testimonials 
          </Text>
        </Center>

        <Center>
          <Box
            w={{ base: "full", md: "1000px" }}
            mt={{ base: "24px", md: "64px" }}
          >
            <Swiper
              spaceBetween={30}
              pagination={{
                clickable: true,
                dynamicBullets: true,
              }}
              modules={[Pagination]}
              className="mySwiper"
            >
              {[...new Array(5)].map((_, idx) => (
                <SwiperSlide key={idx}>
                  <Box
                    bg="#FFFFFF"
                    boxShadow={"0px 0px 16.22px 0px #0000001A"}
                    borderRadius={"20px"}
                    py="75px"
                    mb='50px'
                  >
                    <Container
                      display={"flex"}
                      maxW='840px'
                      gap="56px"
                      flexDir={{ base: "column", md: "row" }}
                    >
                      <Box
                        display={"flex"}
                        justifyContent={{ base: "center", md: "flex-start" }}
                      >
                        <Avatar size={"2xl"} src={'https://bit.ly/kent-c-dodds'} />
                      </Box>
                      <Box>
                        <Text
                          fontSize={"18px"}
                          fontWeight={400}
                          color="#667085"
                        >
                          “Thanks to VaxAI, we have been able to streamline our
                          vaccine management and distribution processes,
                          reducing waste and increasing accessibility for our
                          patients. Their expert support and innovative
                          technology have been invaluable.”
                        </Text>

                        <Box mt="86px">
                          <Text fontSize={"18px"} fontWeight={700} color="#000">
                            Pablo Martin Lozano
                          </Text>
                          <Text
                            fontSize={"18px"}
                            fontWeight={400}
                            color="#667085"
                          >
                            Director, The Online Emporium
                          </Text>
                        </Box>
                      </Box>
                    </Container>
                  </Box>
                </SwiperSlide>
              ))}
            </Swiper>
          </Box>
        </Center>
      </Container>
    </Box>
  );
};

export default Testimonnials;
