import { posts } from "@/app/blog/posts";
import { Box, Container, Flex, Grid, GridItem, Text } from "@chakra-ui/react";
import Link from "next/link";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";
import Prose from "@/components/_shared/Prose";
import CtaBand from "@/components/home/ctaBand";

type PostT = (typeof posts)[number];

const Post = ({ params }: { params: { slug: string } }) => {
  const post: PostT | undefined = posts.find((p) => p.slug === params.slug);
  const others = posts.filter((p) => p.slug !== params.slug).slice(0, 2);

  if (!post) {
    return (
      <Box py="120px">
        <Container maxW="container.xl">
          <Text fontSize="24px" fontWeight={600}>
            Post not found.
          </Text>
          <Link
            href="/blog"
            className="vax-link"
            style={{ marginTop: 16, display: "inline-block" }}
          >
            ← Back to the field dispatch
          </Link>
        </Container>
      </Box>
    );
  }

  return (
    <>
      {/* ---------- Editorial masthead ---------- */}
      <Box bg={tokens.paper} color={tokens.paperInk}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Flex alignItems="center" gap="14px" pt={{ base: "32px", md: "44px" }}>
            <Text
              className="vax-serif"
              fontWeight={700}
              fontSize={{ base: "18px", md: "20px" }}
              letterSpacing="-0.02em"
            >
              VaxAI Vision · Field Dispatch
            </Text>
            <Box flex="1" h="1px" bg={tokens.paperRule} />
            <Link
              href="/blog"
              className="vax-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(26,20,16,0.55)",
              }}
            >
              ← All issues
            </Link>
          </Flex>
          <Box h="1.5px" bg={tokens.paperInk} mt="14px" />
        </Container>
      </Box>

      {/* ---------- Hero ---------- */}
      <Box
        bg={tokens.paper}
        color={tokens.paperInk}
        pt={{ base: "40px", md: "64px" }}
        pb={{ base: "48px", md: "72px" }}
      >
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Box maxW="900px">
            <Eyebrow color={tokens.paperBrick}>Long read · essay</Eyebrow>
            <Text
              as="h1"
              mt="20px"
              className="vax-serif"
              fontWeight={500}
              fontSize={{ base: "36px", md: "72px" }}
              lineHeight="1.0"
              letterSpacing="-0.03em"
              sx={{ textWrap: "balance" }}
            >
              {post.title}
            </Text>
            <Text
              mt="22px"
              fontStyle="italic"
              fontSize={{ base: "16px", md: "19px" }}
              lineHeight="1.55"
              color="rgba(26,20,16,0.65)"
              maxW="780px"
              sx={{ textWrap: "pretty" }}
            >
              {post.sub}
            </Text>

            <Flex
              mt="32px"
              pt="20px"
              borderTop={`1px solid ${tokens.paperRule}`}
              gap="28px"
              flexWrap="wrap"
              fontSize="12px"
              color="rgba(26,20,16,0.55)"
            >
              <Box>
                <Box
                  className="vax-mono"
                  letterSpacing="0.16em"
                  textTransform="uppercase"
                  mb="3px"
                >
                  By
                </Box>
                <Box color={tokens.paperInk} fontWeight={500}>
                  The editors
                </Box>
              </Box>
              <Box>
                <Box
                  className="vax-mono"
                  letterSpacing="0.16em"
                  textTransform="uppercase"
                  mb="3px"
                >
                  Reading time
                </Box>
                <Box color={tokens.paperInk} fontWeight={500}>
                  ~9 min
                </Box>
              </Box>
              <Box>
                <Box
                  className="vax-mono"
                  letterSpacing="0.16em"
                  textTransform="uppercase"
                  mb="3px"
                >
                  Published
                </Box>
                <Box color={tokens.paperInk} fontWeight={500}>
                  May 2026
                </Box>
              </Box>
            </Flex>
          </Box>
        </Container>
      </Box>

      {/* ---------- Cover image ---------- */}
      <Box bg={tokens.paper} pb={{ base: "40px", md: "64px" }}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          {post.image && (
            <Box overflow="hidden" borderRadius="6px" sx={{ aspectRatio: "16/8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image}
                alt={post.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </Box>
          )}
        </Container>
      </Box>

      {/* ---------- Article body ---------- */}
      <Box bg={tokens.bg} py={{ base: "56px", md: "96px" }} borderTop={`1px solid ${tokens.rule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Grid
            templateColumns={{ base: "1fr", lg: "200px 1fr" }}
            gap={{ base: "32px", lg: "80px" }}
            alignItems="start"
          >
            <GridItem display={{ base: "none", lg: "block" }} sx={{ position: "sticky", top: "120px" }}>
              <Text
                className="vax-mono"
                fontSize="10px"
                letterSpacing="0.2em"
                textTransform="uppercase"
                color={tokens.muted}
                mb="10px"
              >
                In this piece
              </Text>
              <Text fontSize="13px" lineHeight="1.65" color={tokens.muted}>
                A long-form essay from the field. References listed at the foot of the article.
              </Text>
              <Link
                href="/blog"
                style={{
                  marginTop: 20,
                  display: "inline-flex",
                  fontSize: 13,
                  fontWeight: 500,
                  color: tokens.brand,
                  borderBottom: `1px solid ${tokens.brand}`,
                  gap: 6,
                }}
              >
                ← Back to all issues
              </Link>
            </GridItem>

            <GridItem>
              {post.other_image && (
                <Box mb="36px" overflow="hidden" borderRadius="6px" sx={{ aspectRatio: "16/9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.other_image}
                    alt={post.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </Box>
              )}
              <Prose html={post.first_content as string} />
              <Box mt="24px">
                <Prose html={post.content as string} />
              </Box>
            </GridItem>
          </Grid>
        </Container>
      </Box>

      {/* ---------- Related posts ---------- */}
      <Box bg="#fafbfd" py={{ base: "64px", md: "96px" }} borderTop={`1px solid ${tokens.rule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Eyebrow>Keep reading</Eyebrow>
          <Text
            as="h2"
            mt="14px"
            mb="40px"
            fontWeight={600}
            fontSize={{ base: "26px", md: "36px" }}
            lineHeight="1.05"
            letterSpacing="-0.025em"
          >
            More from the dispatch.
          </Text>

          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
            gap="0"
            borderTop={`1px solid ${tokens.rule}`}
          >
            {others.map((data, idx) => (
              <GridItem
                key={data.slug}
                bg="#fff"
                padding={{ base: "28px 24px", md: "36px 32px" }}
                borderRight={{ base: "none", md: idx === 0 ? `1px solid ${tokens.rule}` : "none" }}
                borderBottom={`1px solid ${tokens.rule}`}
              >
                <Link href={`/blog/${data.slug}`}>
                  <Box overflow="hidden" borderRadius="6px" mb="18px" sx={{ aspectRatio: "16/9" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.image}
                      alt={data.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </Box>
                  <Text
                    className="vax-mono"
                    fontSize="10px"
                    color={tokens.brand}
                    letterSpacing="0.16em"
                    textTransform="uppercase"
                    mb="10px"
                  >
                    Essay
                  </Text>
                  <Text
                    fontWeight={600}
                    fontSize="20px"
                    letterSpacing="-0.015em"
                    lineHeight="1.25"
                    color={tokens.ink}
                    mb="10px"
                    sx={{ textWrap: "balance" }}
                  >
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

      <CtaBand />
    </>
  );
};

export async function generateStaticParams() {
  return posts.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = posts.find((item) => item.slug === params.slug);
  if (!post) return { title: "Article not found" };
  return {
    title: post.title,
    description: post.sub,
    alternates: { canonical: `https://www.vaxaivision.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.sub,
      url: `https://www.vaxaivision.com/blog/${post.slug}`,
      images: [
        {
          url: post.image,
          width: 1920,
          height: 1080,
          alt: post.title,
          secure_url: post.image,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.sub,
      image: post.image,
    },
  };
}

export default Post;
