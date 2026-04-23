import { Box, Text, Center } from "@chakra-ui/react";
import React from "react";
import close from "@/assets/close.png";
import Image from "next/image";
import Link from "next/link";
import { FaLinkedin } from "react-icons/fa6";

const Mobile = ({ onClose, routes, pathname }: any) => {
  return (
    <Box py="22px" px="16px">
      <Box display={"flex"} justifyContent={"flex-end"}>
        <Box onClick={onClose}>
          <Image src={close} alt="close icon" />
        </Box>
      </Box>

      <Box display={"flex"} flexDir={"column"} gap="24px" h="80vh">
        {routes.map((data: any, idx: number) => (
          <Link
            key={idx}
            href={data.path}
            style={{
              color:
                pathname === data.path
                  ? "#F56630"
                  : pathname.includes("blog") && data.path.includes("blog")
                  ? "#F56630"
                  : pathname.includes("solutions") &&
                    data.path.includes("solutions")
                  ? "#F56630"
                  : "#fff",
              fontSize: "18px",
              fontWeight: "600",
            }}
          >
            {data.name}
          </Link>
        ))}

        <Link
          href="/waitlist"
          style={{ fontSize: "18px", fontWeight: 600, color: "white" }}
        >
          Join our waitlist
        </Link>
      </Box>

      <Box>
        <Text
          color="#fff"
          fontSize={"18px"}
          fontWeight={600}
          textAlign={"center"}
        >
          Follow us at
        </Text>
        <Center>
          <Box display={"flex"} alignContent={"center"} gap="24px" mt="10px">
            <a
              href="https://www.linkedin.com/company/vaxai-vision/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="VaxAI Vision on LinkedIn"
            >
              <FaLinkedin color={"#fff"} size={20} />
            </a>
          </Box>
        </Center>
      </Box>
    </Box>
  );
};

export default Mobile;
