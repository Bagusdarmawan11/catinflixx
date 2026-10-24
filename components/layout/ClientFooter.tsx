"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ClientFooter() {
  const pathname = usePathname();

  // Sembunyikan footer di halaman room watch-party dan halaman watch-party utama
  if (pathname?.startsWith("/watch-party")) {
    return null;
  }

  return <Footer />;
}
