import type { Metadata } from "next";
import "./globals.css";
import { ChakraProvider } from "@chakra-ui/react";
import { fontVars } from "@/app/fonts";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "VaxAI Vision — Precision for the last cold mile",
  description:
    "AI-driven vaccine supply chain intelligence — computer vision, demand forecasting, and cold-chain telemetry for last-mile immunisation programmes.",
  icons: {
    icon: ["/favicon.ico?v=4"],
    apple: ["/apple-touch-icon.png?v=4"],
    shortcut: ["/apple-touch-icon.png"],
  },
  openGraph: {
    title: "VaxAI Vision",
    description:
      "AI-driven vaccine supply chain intelligence for last-mile immunisation programmes.",
    images: [
      {
        url: "https://res.cloudinary.com/alonexx/image/upload/v1718996685/Screenshot_2024-06-21_at_20.03.46_jm7wvt.png",
        width: 800,
        height: 600,
        alt: "VaxAI Vision",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaxAI Vision",
    description:
      "AI-driven vaccine supply chain intelligence for last-mile immunisation programmes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={fontVars}>
        <ChakraProvider>{children}</ChakraProvider>
        <Analytics />
      </body>
    </html>
  );
}
