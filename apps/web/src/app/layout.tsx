import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { RaceSync } from "@/components/race-sync";
import { SiteHeader } from "@/components/site-header";
import { useRaceIdFromPath } from "@/app/(shared)/hooks/use-race-id";
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
  title: {
    default: "FatChrono",
    template: "%s — FatChrono",
  },
  description:
    "Платформа хронометража велогонок с авторизацией через Telegram и живыми результатами.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <AuthProvider />
        <RaceSync />
        <SiteHeader />
        <main className="min-h-[calc(100vh-64px)]">
          <RacePathWatcher />
          {children}
        </main>
      </body>
    </html>
  );
}

function RacePathWatcher() {
  useRaceIdFromPath();
  return null;
}
