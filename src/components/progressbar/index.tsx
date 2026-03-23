"use client";

import React, { useState, useRef, useEffect } from "react";
import { Box } from "@chakra-ui/react";

const ProgressBar = ({ percentage }: any) => {
  const [isInView, setIsInView] = useState(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const checkIfInView = () => {
    if (progressBarRef.current) {
      const scrollPosition = window.scrollY + window.innerHeight;
      const elementPosition =
        progressBarRef?.current?.getBoundingClientRect().top + window.scrollY;

      if (scrollPosition >= elementPosition) {
        setIsInView(true);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", checkIfInView);
    checkIfInView(); // Check on mount

    return () => {
      window.removeEventListener("scroll", checkIfInView);
    };
  }, []);

  return (
    <Box bg="#F3F4F6" borderRadius={"2px"} h="10px" w="100%">
      <Box
        h="10px"
        borderRadius={"2px"}
        bg="#3A5BCC"
        ref={progressBarRef}
        w={isInView ? `${percentage}%` : "0%"}
        transition={"width 1s ease-out"}
      />
    </Box>
  );
};

export default ProgressBar;
