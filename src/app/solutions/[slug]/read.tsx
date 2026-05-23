import { solutions } from "@/utils/enums";
import { Box, Container, Grid, GridItem, Text } from "@chakra-ui/react";
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { tokens } from "@/components/home/_tokens";
import { Eyebrow } from "@/components/home/_atoms";
import Prose from "@/components/_shared/Prose";
import CtaBand from "@/components/home/ctaBand";

type Solution = (typeof solutions)[number];

const Read = ({ params }: { params: { slug: string } }) => {
  const item: Solution | undefined = solutions.find(
    (s) => s.slug === params.slug
  );
  const others = solutions.filter((s) => s.slug !== params.slug).slice(0, 3);

  if (!item) {
    return (
      <Box py="120px">
        <Container maxW="container.xl">
          <Text fontSize="24px" fontWeight={600}>
            Solution not found.
          </Text>
          <Link href="/solutions" className="vax-link" style={{ marginTop: 16, display: "inline-block" }}>
            ← Back to all solutions
          </Link>
        </Container>
      </Box>
    );
  }

  return (
    <>
      {/* ---------- Editorial article header ---------- */}
      <Box
        bg={tokens.paper}
        color={tokens.paperInk}
        pt={{ base: "56px", md: "80px" }}
        pb={{ base: "56px", md: "72px" }}
      >
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Box maxW="820px">
            <Eyebrow color={tokens.paperBrick}>Platform · deep dive</Eyebrow>
            <Text
              as="h1"
              mt="20px"
              className="vax-serif"
              fontWeight={500}
              fontSize={{ base: "36px", md: "64px" }}
              lineHeight="1.0"
              letterSpacing="-0.03em"
              sx={{ textWrap: "balance" }}
            >
              {item.title}
            </Text>
            <Text
              mt="22px"
              fontStyle="italic"
              fontSize={{ base: "16px", md: "18px" }}
              lineHeight="1.6"
              color="rgba(26,20,16,0.65)"
              maxW="700px"
              sx={{ textWrap: "pretty" }}
            >
              {item.other}
            </Text>

            <Box
              mt="32px"
              pt="20px"
              borderTop={`1px solid ${tokens.paperRule}`}
              display="flex"
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
                  Module
                </Box>
                <Box color={tokens.paperInk} fontWeight={500}>
                  {item.title}
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
                  ~6 min
                </Box>
              </Box>
              <Box>
                <Box
                  className="vax-mono"
                  letterSpacing="0.16em"
                  textTransform="uppercase"
                  mb="3px"
                >
                  Last updated
                </Box>
                <Box color={tokens.paperInk} fontWeight={500}>
                  May 2026
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ---------- Full-bleed image ---------- */}
      <Box bg={tokens.paper} pb={{ base: "40px", md: "64px" }}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          {item.image && (
            <Box overflow="hidden" borderRadius="6px" sx={{ aspectRatio: "16/8" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </Box>
          )}
          <Text
            mt="14px"
            fontSize="12px"
            fontStyle="italic"
            color="rgba(26,20,16,0.55)"
            lineHeight="1.55"
          >
            <Box as="strong" color={tokens.paperInk} fontStyle="normal">
              Fig. 1 —
            </Box>{" "}
            {item.title} in deployment.
          </Text>
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
            {/* Side rail */}
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
                A walkthrough of {item.title.toLowerCase()} — what it does, how it works,
                and where it fits in a real-world programme.
              </Text>
              <Link
                href="/demo"
                style={{
                  marginTop: 20,
                  display: "inline-flex",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: tokens.brand,
                  borderBottom: `1px solid ${tokens.brand}`,
                }}
              >
                Try it in the live demo →
              </Link>
            </GridItem>

            {/* Body */}
            <GridItem>
              <Prose html={item.content as string} />
            </GridItem>
          </Grid>
        </Container>
      </Box>

      {/* ---------- Related solutions ---------- */}
      <Box bg="#fafbfd" py={{ base: "64px", md: "96px" }} borderTop={`1px solid ${tokens.rule}`}>
        <Container maxW="container.xl" px={{ base: "20px", md: "32px" }}>
          <Eyebrow>Adjacent surfaces</Eyebrow>
          <Text
            as="h2"
            mt="14px"
            mb="40px"
            fontWeight={600}
            fontSize={{ base: "26px", md: "36px" }}
            lineHeight="1.05"
            letterSpacing="-0.025em"
            maxW="640px"
          >
            Other modules that pair with this one.
          </Text>

          <Grid
            templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
            gap="0"
            borderTop={`1px solid ${tokens.rule}`}
          >
            {others.map((data, idx, arr) => (
              <GridItem
                key={data.slug}
                bg="#fff"
                padding="32px 28px"
                borderRight={{
                  base: "none",
                  md: idx === arr.length - 1 ? "none" : `1px solid ${tokens.rule}`,
                }}
                borderBottom={`1px solid ${tokens.rule}`}
                display="flex"
                flexDir="column"
              >
                <Text
                  className="vax-mono"
                  fontSize="11px"
                  color={tokens.brand}
                  letterSpacing="0.14em"
                  mb="16px"
                >
                  {String(idx + 1).padStart(2, "0")}
                </Text>
                {data.icon && (
                  <Box w="36px" h="36px" mb="16px" sx={{ position: "relative" }}>
                    <Image
                      src={data.icon}
                      alt={data.title}
                      width={36}
                      height={36}
                      style={{ width: "36px", height: "36px", objectFit: "contain" }}
                    />
                  </Box>
                )}
                <Text fontWeight={600} fontSize="18px" letterSpacing="-0.015em" mb="10px">
                  {data.title}
                </Text>
                <Text fontSize="13.5px" lineHeight="1.65" color={tokens.muted} mb="20px" flex="1">
                  {data.description}
                </Text>
                <Link href={`/solutions/${data.slug}`} className="vax-link" style={{ fontSize: 13, fontWeight: 500 }}>
                  Read the deep-dive →
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
  return solutions.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = solutions.find((item) => item.slug === params.slug);
  if (!post) return { title: "Solution not found" };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://www.vaxaivision.com/solutions/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.vaxaivision.com/solutions/${post.slug}`,
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
      description: post.description,
      image: post.image,
    },
  };
}

export default Read;
