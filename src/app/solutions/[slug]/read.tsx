import { solutions } from "@/utils/enums";
import {
  Box,
  Container,
  Grid,
  GridItem,
  Text,
  Button,
  Image as Images,
} from "@chakra-ui/react";
import Link from "next/link";
import Image from "next/image";

const Read = ({ params }: any) => {
  const items = solutions.find((item) => item.slug === params.slug);

  const others = solutions.filter((item) => item.slug !== params.slug);

  return (
    <Box mt="32px">
      <Box
        display={{ base: "none", md: "grid" }}
        placeItems={"center"}
        bg="#FBFBFB"
        py={{ base: "37px", md: "55px" }}
        mb="73px"
      >
        <Container maxW="container.xl">
          <Text
            textAlign={"center"}
            fontSize={{ base: "24px", md: "40px" }}
            fontWeight={700}
            color="#000000"
          >
            {items?.title}
          </Text>
        </Container>
      </Box>

      <Container maxW="container.xl">
        <Text
          fontSize={"16px"}
          fontWeight={600}
          color="#667085"
          display={{ base: "none", md: "block" }}
        >
          {items?.other}
        </Text>

        <Images
          src={items?.image}
          alt={items?.title}
          display={{ base: "none", md: "block" }}
          height={{ base: "240px", md: "auto" }}
          style={{
            marginTop: "40px",
            objectFit: "cover",
            width: "100%",
          }}
        />

        <Images
          src={items?.small}
          alt={items?.title}
          display={{ base: "block", md: "none" }}
          height='auto'
          style={{
            marginTop: "40px",
            objectFit: "cover",
            width: "100%",
          }}
        />

        <Text
          fontSize={"18px"}
          fontWeight={700}
          mt={"32px"}
          mb="12px"
          color="#1A1A1A"
          display={{ base: "block", md: "none" }}
        >
          {items?.title}
        </Text>

        <Text
          fontSize={"14px"}
          fontWeight={400}
          color="#667085"
          display={{ base: "block", md: "none" }}
        >
          {items?.other}
        </Text>
        <Box
          mb="100px"
          mt="40px"
          color="#667085"
          fontSize={"16px"}
          fontWeight={400}
        >
          <div dangerouslySetInnerHTML={{ __html: items?.content as any }} />
        </Box>

        <Box mb="120px">
          <Text
            fontSize={{ base: "24px", md: "40px" }}
            fontWeight={600}
            color="#1A1A1A"
            textAlign={"center"}
          >
            Other Solutions
          </Text>
          <Grid
            mt="55px"
            templateColumns={{ base: "auto", md: "repeat(3,1fr)" }}
            gap="45px"
          >
            {others.slice(0, 3).map((data, idx) => (
              <GridItem key={idx}>
                <Box
                  borderRadius={"10px"}
                  border="1px solid #DEE5ED"
                  bg="#fff"
                  p="24px"
                >
                  <Image
                    src={data?.icon}
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
        </Box>
      </Container>
    </Box>
  );
};

export async function generateStaticParams() {
  return solutions.map((item) => ({
    slug: item.slug,
  }));
}

export async function generateMetadata({ params }: any) {
  const post = solutions.find((item) => item.slug === params.slug);

  if (!post) {
    return {
      title: "Article not found",
    };
  }

  return {
    title: post.title,
    description: post.description,
    canonical: `https://www.vaxaivision.com/solutions/${post.slug}`,
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
