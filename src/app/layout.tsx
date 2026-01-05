import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Excel-to-Quote Copilot | AI-Powered Quote Analysis",
  description: "Transform complex Excel BOMs into structured quotes with AI-powered column mapping and automatic risk detection. Zero data retention.",
  keywords: ["quote", "excel", "AI", "sales engineering", "BOM", "risk assessment", "incoterms"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
