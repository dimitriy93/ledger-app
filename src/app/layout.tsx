import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const appTitle = "Ledger — Финансовый регистр";
const appDescription =
  "Персональный финансовый регистр: бюджет 15 000 ₽ на период, быстрый ввод покупок и текущий остаток. Данные хранятся только на вашем устройстве.";

export const metadata: Metadata = {
  title: appTitle,
  description: appDescription,
  applicationName: "Ledger",
  manifest: "./manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ledger",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "./icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "./icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "./icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#070b15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
