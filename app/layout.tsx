import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeInitScript from "@/components/ThemeInitScript";
import SiteHeader from "@/components/SiteHeader";
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
  title: "NMAT Reviewer",
  description: "Practice quizzes for NMAT by GMAC — timed sections, instant review, and explained answers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeInitScript />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
