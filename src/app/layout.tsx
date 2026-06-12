import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Derby Aggs — Track your delivery",
  description: "Track your Pall-Ex delivery — enter your tracking number and delivery postcode.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* D-12: print stylesheet — hides interactive controls at print time */}
        <link rel="stylesheet" href="/print.css" media="print" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
