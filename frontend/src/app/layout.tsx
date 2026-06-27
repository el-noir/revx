import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revcon — AI Reverse Engineering Agent",
  description: "An autonomous AI agent for reverse engineering and CTF solving.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
