import { Box, Button, Center, Container, Input, Text } from "@chakra-ui/react";
import React from "react";

const Subscribe = () => {
  return (
    <Box bg="#FBFBFB" py={{base:'41px', md: "121px"}}>
      <Container maxW="container.xl">
        <Center>
          <Text
            fontSize={{base:'16px', md: "42px"}}
            fontWeight={700}
            color="#1A1A1A"
            textAlign={"center"}
            w={{ base: "auto", md: "932px" }}
          >
            Transforming Vaccine Management and Distribution with Innovative
            Solutions and Dedicated Healthcare Expertise
          </Text>
        </Center>

    
          <Box display={'flex'} justifyContent={{base:'flex-start', md:'center'}}>
          <Box
            w={{ base: "full", md: "665px" }}
            display={"flex"}
            flexDir={"column"}
            gap="10px"
            mt="24px"
          >
            <Input
              border="1px solid #DEE5ED"
              borderRadius={"10px"}
              h="48px"
              placeholder="Email"
              focusBorderColor="#3A5BCC"
              _placeholder={{
                color: "#667085",
                fontSize: "16px",
                fontWeight: 400,
              }}
            />
            <Button
              bg="#3A5BCC"
              borderRadius={"10px"}
              color="#fff"
              fontSize={"14px"}
              fontWeight={400}
              h="56px"
              w="full"
              _hover={{
                opacity: 0.8,
              }}
            >
              Subscribe
            </Button>
          </Box>
          </Box>
         
   
      </Container>
    </Box>
  );
};

export default Subscribe;
