import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";
import { ChatWidget } from "@/components/ChatWidget";
import { DemoWarningBanner } from "@/components/DemoWarningBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const orgName = process.env.NEXT_PUBLIC_ORG_NAME ?? "Schemamotor";

export const metadata: Metadata = {
  title: "Sintari — Specialbyggda schemasystem",
  description: "Ditt schema. Dina regler. Klart på minuter.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`${inter.variable} ${fraunces.variable} ${mono.variable}`}>
      <body>
        {children}
        <CookieBanner />
        <DemoWarningBanner />
        <ChatWidget />
      </body>
    </html>
  );
}
