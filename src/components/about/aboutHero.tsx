import { Box, Center, Container, Text } from "@chakra-ui/react";
import React from "react";

const AboutHero = () => {
  return (
    <Box bg="#FBFBFB" py={{base: '24px', md: "55px"}} mb={{base: '40px', md: '80px'}}>
      <Container maxW="container.xl">
        <Center>
          <Text
            lineHeight={{base:'20px', md: "40px"}}
            fontSize={{base: '16px', md: "40px"}}
            color="#1A1A1A"
            fontWeight={700}
            textAlign={"center"}
            w={{base: 'auto', md: '1100px'}}
          >
           Get to know more about us
          </Text>
        </Center>
      </Container>
    </Box>
  );
};

export default AboutHero;
