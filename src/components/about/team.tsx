import { team } from "@/utils/enums";
import { Box, Container, Grid, Image, Text } from "@chakra-ui/react";
import Link from "next/link";
import React from "react";
import { MdEmail } from "react-icons/md";
import { FaLinkedin } from "react-icons/fa6";

const Team = () => {
  return (
    <Box mt={{ base: "50px", md: "115px" }} mb="32px">
      <Container maxW="container.xl">
        <Text
          fontSize={{ base: "24px", md: "42px" }}
          fontWeight={700}
          textAlign={"center"}
          color="#1A1A1A"
          mb={{ base: "10px", md: "64px" }}
        >
          Meet Our Team
        </Text>

        <Grid
          templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
          gap={{ base: "24px", md: "78px" }}
        >
          {team.map((data, idx) => (
            <Box key={idx}>
              <Image src={data.image} alt={data.name} mb="16px" />
              <Text
                fontSize={{ base: "16px", md: "24px" }}
                fontWeight={700}
                color="#212121"
                mb="8px"
              >
                {data.name} - {data.position}
              </Text>
              <Text
                fontSize={{ base: "14px", md: "18px" }}
                fontWeight={400}
                color="#667085"
                mb="12px"
              >
                {data.bio}
              </Text>

              <Box display={"flex"} alignItems={"center"} gap="13px">
                <Link href={`mailto:${data.email}`}>
                  <Box
                    display={"grid"}
                    placeItems={"center"}
                    w="28px"
                    h="28px"
                    bg="#898989"
                    borderRadius={"full"}
                  >
                    <MdEmail color="#FFFFFF" />
                  </Box>
                </Link>
                <Link href={`${data.linkedIn}`} target="_blank">
                  <Box
                    display={"grid"}
                    placeItems={"center"}
                    w="28px"
                    h="28px"
                    bg="#898989"
                    borderRadius={"full"}
                  >
                    <FaLinkedin color="#FFFFFF" />
                  </Box>
                </Link>
              </Box>
            </Box>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Team;
