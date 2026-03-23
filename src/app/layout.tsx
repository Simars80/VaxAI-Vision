import type { Metadata } from "next";
import "./globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import { fonts } from "@/app/fonts";

export const metadata: Metadata = {
  title: "VaxAI",
  description:
    "The leader in advanced solutions for efficient vaccine distribution and inventory management.",
  icons: {
    icon: ["/favicon.ico?v=4"],
    apple: ["/apple-touch-icon.png?v=4"],
    shortcut: ["/apple-touch-icon.png"],
  },
  openGraph: {
    title: "VaxAI",
    description:
      "The leader in advanced solutions for efficient vaccine distribution and inventory management.",

    images: [
      {
        url: "https://res.cloudinary.com/alonexx/image/upload/v1718996685/Screenshot_2024-06-21_at_20.03.46_jm7wvt.png",
        width: 800,
        height: 600,
        alt: "VaxAI-Vision",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaxAI",
    description: `The leader in advanced solutions for efficient vaccine distribution and inventory management.`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={fonts.montserrat.className}>
        <ChakraProvider>{children}</ChakraProvider>
      </body>
    </html>
  );
}
