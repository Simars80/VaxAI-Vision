import { Box } from "@chakra-ui/react";
import React from "react";

const SideModal = ({ onClose, isOpen, children }: any) => {
  return (
    <Box>
      <Box
        bg="black"
        opacity="0.5"
        position="fixed"
        top="0"
        w="100%"
        h="100vh"
        onClick={onClose}
        left={isOpen ? "0" : "-100%"}
        zIndex="15"
        transition="0.3s ease-in-out"
      />
      <Box
        position="fixed"
        top="0"
        w="full"
        h="100vh"
        left={isOpen ? "0" : "-100%"}
        zIndex="16"
        bg="#3A5BCC"
        opacity={isOpen ? "100%" : "0"}
        transition="0.3s ease-in-out"
        overflowY="scroll"
      >
        {children}
      </Box>
    </Box>
  );
};

export default SideModal;
