import type { Metadata } from "next";
import { Fraunces, Nunito_Sans, Caveat } from "next/font/google";
import { config } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: config.siteUrl ? new URL(config.siteUrl) : undefined,
  title: config.title,
  description: `${config.subtitle} — a living photo book of moments worth keeping.`,
  applicationName: config.title,
  // Personal journal: don't let search engines index it.
  robots: { index: false, follow: false },
  openGraph: {
    title: config.title,
    description: `${config.subtitle} — a living photo book of moments worth keeping.`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: config.title,
    description: `${config.subtitle} — a living photo book of moments worth keeping.`,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${nunito.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
