"use client";

import { Box } from "@chakra-ui/react";
import React from "react";

/**
 * Prose — render rich HTML (from a CMS, MDX, or hand-written `dangerouslySetInnerHTML`)
 * with our typographic system applied. See .vax-prose in globals.css for rules.
 */
const Prose = ({ html, maxW = "720px" }: { html?: string; maxW?: string }) => {
  if (!html) return null;
  return (
    <Box
      className="vax-prose"
      sx={{ maxWidth: maxW }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default Prose;
