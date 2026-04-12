import React from "react";
import Hero from "@/components/home/hero";
import Solutions from "@/components/home/solutions";
import Faqs from "@/components/home/faq";
import Testimonnials from "@/components/home/testimonnials";
import Layout from "@/components/layout";
import AboutComponent from "@/components/home/about";
import DemoEmbed from "@/components/home/DemoEmbed";

const Home = () => {
  return (
    <Layout>
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
