import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "СтройCRM — объекты и задачи",
  description: "Мини-CRM для строительной компании: объекты, задачи, статусы и история.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
