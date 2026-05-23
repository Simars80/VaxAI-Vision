import React from "react";
import Layout from "@/components/layout";
import Hero from "@/components/home/hero";
import TrustStrip from "@/components/home/trustStrip";
import Solutions from "@/components/home/solutions";
import Coverage from "@/components/home/coverage";
import Mission from "@/components/home/mission";
import DemoEmbed from "@/components/home/demoEmbed";
import ImpactStrip from "@/components/home/impactStrip";
import FAQ from "@/components/home/faq";
import Testimonials from "@/components/home/testimonials";
import CtaBand from "@/components/home/ctaBand";

const Home = () => {
  return (
    <Layout>
      <Hero />
      <TrustStrip />
      <Solutions />
      <Coverage />
      <Mission />
      <DemoEmbed />
      <ImpactStrip />
      <FAQ />
      <Testimonials />
      <CtaBand />
    </Layout>
  );
};

export default Home;
