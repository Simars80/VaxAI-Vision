"use client";

import React from "react";
import PageHero from "@/components/_shared/PageHero";

const AboutHero = () => {
  return (
    <PageHero
      eyebrow="About VaxAI Vision"
      title={
        <>
          Built by the people who&apos;ve carried the cold boxes.
        </>
      }
      sub="We are a small team of pharmacists, physicians, data scientists, and field operators who have spent the last decade closing supply-chain gaps in immunisation programmes. VaxAI Vision is the tool we wished we'd had."
    />
  );
};

export default AboutHero;
