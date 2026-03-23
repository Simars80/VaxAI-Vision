import { posts } from "@/app/blog/posts";
import { Box, Container, Grid, GridItem, Image, Text } from "@chakra-ui/react";

const Post = ({ params }: any) => {
  const post = posts.find((item) => item.slug === params.slug);

  return (
    <Box mt="64px">
      <Container maxW="container.xl">
        <Grid
          templateColumns={{ base: "auto", md: "repeat(2,1fr)" }}
          gap={{ base: "24px", md: "40px" }}
          gridTemplateRows={"auto"}
        >
          <GridItem>
            <Image
              src={post?.other_image}
              alt={post?.title}
              mb={{ base: "24px", md: "56px" }}
              w="full"
              h={"full"}
              objectFit={"cover"}
            />
          </GridItem>
          <GridItem>
            <Text
              fontSize={{ base: "16px", md: "40px" }}
              fontWeight={{ base: 700, md: 600 }}
              color="#1A1A1A"
            >
              {post?.title}
            </Text>

            <Box color="#667085" fontSize={"16px"} fontWeight={400}>
              <div
                dangerouslySetInnerHTML={{ __html: post?.first_content as any }}
              />
            </Box>
          </GridItem>
        </Grid>

        <Box
          mb="120px"
          mt={{ base: "24px", md: "40px" }}
          color="#667085"
          fontSize={"16px"}
          fontWeight={400}
        >
          <div dangerouslySetInnerHTML={{ __html: post?.content as any }} />
        </Box>
      </Container>
    </Box>
  );
};

export async function generateStaticParams() {
  return posts.map((item) => ({
    slug: item.slug,
  }));
}

export async function generateMetadata({ params }: any) {
  const post = posts.find((item) => item.slug === params.slug);

  if (!post) {
    return {
      title: "Article not found",
    };
  }

  return {
    title: post.title,
    description: post.sub,
    canonical: `https://www.vaxaivision.com/blog/${post.slug}`,
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
