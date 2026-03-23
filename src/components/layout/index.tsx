import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import { Box } from "@chakra-ui/react";
import React from "react";

const Layout = ({ children }: any) => {
  return (
    <Box display={"flex"} flexDir={"column"}>
      <Navbar />
      <Box mt={{base: '105px', md: '90px' }} >{children}</Box>
      <Footer />
    </Box>
  );
};

export default Layout;
