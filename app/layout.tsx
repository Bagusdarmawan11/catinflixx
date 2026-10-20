import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CatinFlix",
    template: "%s | CatinFlix",
  },
  description:
    "Platform katalog dan streaming film modern — drama Korea, China, Indonesia, dan lebih banyak lagi.",
  keywords: ["streaming", "film", "drakor", "drama", "series", "watch party"],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "CatinFlix",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f13",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-cf-bg text-cf-text antialiased">{children}</body>
    </html>
  );
}
