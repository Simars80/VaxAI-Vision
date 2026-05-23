import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const fonts = {
  inter,
  fraunces,
  plexMono,
};

// Concatenated class string for the <body> tag in layout.tsx.
// Sets up CSS custom properties so any element can opt into the serif or
// mono face via `font-family: var(--font-serif)` etc.
export const fontVars = `${inter.variable} ${fraunces.variable} ${plexMono.variable}`;
