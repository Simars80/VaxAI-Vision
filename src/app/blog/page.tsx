import { posts } from "@/app/blog/posts";
import Layout from "@/components/layout";
import { Box, Container, Text, Center, Grid, Image } from "@chakra-ui/react";
import Link from "next/link";
import React from "react";

const Blog = () => {
  return (
    <Layout>
      <Box bg="#FBFBFB" py={{ base: "37px", md: "55px" }}>
        <Container maxW="container.xl">
          <Center>
            <Text
              lineHeight={{ base: "20px", md: "40px" }}
              fontSize={{ base: "16px", md: "40px" }}
              color="#1A1A1A"
              fontWeight={700}
              textAlign={"center"}
              w={{ base: "auto", md: "1100px" }}
            >
              Read exciting and innovative post
            </Text>
          </Center>
        </Container>
      </Box>

      <Box my={{ base: "40px", md: "140px" }}>
        <Container maxW="container.xl">
          <Text
            mb="32px"
            color="#1A1A1A"
            fontSize={"24px"}
            fontWeight={600}
            textAlign={{ base: "center", md: "left" }}
          >
            All blog posts
          </Text>
          <Grid
            templateColumns={{ base: "auto", md: "repeat(3,1fr)" }}
            gap="33px"
          >
            {posts.map((data, idx) => (
              <Box key={idx}>
                <Image src={data.image} alt={data.title} />

                <Text
                  color="#1A1A1A"
                  mt="32px"
                  fontSize={"20px"}
                  fontWeight={600}
                  mb="12px"
                >
                  {data.title}
                </Text>
                <Text color="#667085" fontSize={"16px"} fontWeight={400}>
                  {data.sub}
                </Text>

                <Link href={`/blog/${data.slug}`}>
                  <Text
                    mt="24px"
                    fontSize={"16px"}
                    fontWeight={600}
                    color="#F56630"
                  >
                    Read more
                  </Text>
                </Link>
              </Box>
            ))}
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
};

export default Blog;
