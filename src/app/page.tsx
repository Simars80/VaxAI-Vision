import React from "react";
import Hero from "@/components/home/hero";
import Solutions from "@/components/home/solutions";
import Faqs from "@/components/home/faq";
import Testimonnials from "@/components/home/testimonnials";
import Layout from "@/components/layout";
import AboutComponent from "@/components/home/about";
import DemoEmbed from "@/components/home/DemoEmbed";
import Head from "next/head";

const Home = () => {
  return (
    <Layout>
      <Head>
        <title>VaxAI | Home</title>
      </Head>
      <Hero />
      <DemoEmbed />
      <Solutions />
      <AboutComponent />
      <Faqs />
      <Testimonnials />
    </Layout>
  );
};

export default Home;
