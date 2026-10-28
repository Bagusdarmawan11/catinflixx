import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import ClientFooter from "@/components/layout/ClientFooter";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "CatinFlix — Streaming Film & Serial",
    template: "%s | CatinFlix",
  },
  description:
    "Platform streaming film dan serial TV terlengkap dengan fitur Watch Party untuk nonton bareng teman.",
  keywords: ["streaming", "film", "serial", "watch party", "bioskop online"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "CatinFlix",
    description: "Platform streaming film dan serial TV terlengkap",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <ToastProvider>
          <Navbar />
          <div>{children}</div>
          <ClientFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
