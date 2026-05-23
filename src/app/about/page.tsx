import React from "react";
import Layout from "@/components/layout";
import AboutHero from "@/components/about/aboutHero";
import Mission from "@/components/home/mission";
import ValuesComponent from "@/components/about/values";
import Team from "@/components/about/team";
import CtaBand from "@/components/home/ctaBand";

const About = () => {
  return (
    <Layout>
      <AboutHero />
      <Mission />
      <ValuesComponent />
      <Team />
      <CtaBand />
    </Layout>
  );
};

export default About;
