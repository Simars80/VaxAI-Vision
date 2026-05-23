import React from "react";
import { posts } from "@/app/blog/posts";
import Layout from "@/components/layout";
import { Box, Container, Grid, GridItem, Image, Text } from "@chakra-ui/react";
import Link from "next/link";
import PageHero from "@/components/_shared/PageHero";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";

const Blog = () => {
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <Layout>
      <PageHero
        mode="editorial"
        eyebrow="Field dispatch"
        title={<>Notes from the cold chain.</>}
        sub="Long reads on vaccine equity, supply-chain innovation, and the people who keep immunisation programmes alive."
      />

      {/* Featured */}
      <Box bg={tokens.paper} pb={{ base: "48px", md: "96px" }} borderBottom={`1px solid ${tokens.paperRule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Link href={`/blog/${featured.slug}`}>
            <Box bg="#fff" border={`1px solid ${tokens.paperRule}`} borderRadius="10px" overflow="hidden"
                 display="grid"
                 gridTemplateColumns={{ base: "1fr", md: "1.2fr 1fr" }}
                 _hover={{ boxShadow: "0 12px 32px rgba(26,20,16,0.08)" }}
                 transition="box-shadow 0.2s ease">
              <Box overflow="hidden" sx={{ aspectRatio: { base: "16/9", md: "auto" } as never }}>
                <Image src={featured.image} alt={featured.title} w="100%" h="100%" objectFit="cover" />
              </Box>
              <Box padding={{ base: "28px 24px", md: "48px 44px" }} display="flex" flexDir="column" justifyContent="center">
                <Text className="vax-mono" fontSize="10px" color={tokens.paperBrick}
                      letterSpacing="0.2em" textTransform="uppercase" mb="12px">
                  Featured · long read
                </Text>
                <Text className="vax-serif" fontWeight={500}
                      fontSize={{ base: "28px", md: "40px" }}
                      lineHeight="1.05" letterSpacing="-0.02em"
                      color={tokens.paperInk}
                      sx={{ textWrap: "balance" }}>
                  {featured.title}
                </Text>
                <Text mt="16px" fontSize="15px" lineHeight="1.65"
                      color="rgba(26,20,16,0.7)" sx={{ textWrap: "pretty" }}>
                  {featured.sub}
                </Text>
                <Text mt="24px" fontSize="13px" fontWeight={600} color={tokens.paperBrick}>
                  Read the full piece →
                </Text>
              </Box>
            </Box>
          </Link>
        </Container>
      </Box>

      {/* Archive */}
      <Box bg={tokens.bg} py={{ base: "64px", md: "110px" }}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Box mb="40px">
            <Eyebrow>The archive</Eyebrow>
            <Text as="h2" mt="14px" fontWeight={600}
                  fontSize={{ base: "26px", md: "36px" }}
                  lineHeight="1.05" letterSpacing="-0.025em">
              All blog posts.
            </Text>
          </Box>

          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }} gap="0"
                borderTop={`1px solid ${tokens.rule}`}>
            {rest.map((data, idx, arr) => (
              <GridItem key={idx}
                bg="#fff"
                padding={{ base: "28px 4px", md: "36px 32px" }}
                borderRight={{
                  base: "none",
                  md: idx % 2 === 1 ? "none" : `1px solid ${tokens.rule}`,
                  lg: idx % 3 === 2 || idx === arr.length - 1 ? "none" : `1px solid ${tokens.rule}`,
                }}
                borderBottom={`1px solid ${tokens.rule}`}>
                <Link href={`/blog/${data.slug}`}>
                  <Box overflow="hidden" borderRadius="6px" mb="18px">
                    <Image src={data.image} alt={data.title} w="100%" objectFit="cover" />
                  </Box>
                  <Text className="vax-mono" fontSize="10px" color={tokens.brand}
                        letterSpacing="0.16em" textTransform="uppercase" mb="10px">
                    {String(idx + 2).padStart(2, "0")} · Essay
                  </Text>
                  <Text fontWeight={600} fontSize={{ base: "18px", md: "20px" }}
                        letterSpacing="-0.015em" lineHeight="1.25"
                        color={tokens.ink} mb="10px"
                        sx={{ textWrap: "balance" }}>
                    {data.title}
                  </Text>
                  <Text color={tokens.muted} fontSize="14px" lineHeight="1.6">
                    {data.sub}
                  </Text>
                  <Text mt="18px" fontSize="13px" fontWeight={500} color={tokens.brand}>
                    Read more →
                  </Text>
                </Link>
              </GridItem>
            ))}
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
};

export default Blog;
