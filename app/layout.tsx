import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "CatinFlix — Streaming Film & Serial",
    template: "%s | CatinFlix",
  },
  description:
    "Platform streaming film dan serial TV terlengkap dengan fitur Watch Party untuk nonton bareng teman.",
  keywords: ["streaming", "film", "serial", "watch party", "bioskop online"],
  openGraph: {
    title: "CatinFlix",
    description: "Platform streaming film dan serial TV terlengkap",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <Navbar />
        <div className="min-h-screen">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
