
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PublicNavbar from "../components/PublicNavbar";
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
    default: "Football Tournament Management System",
    template: "%s | Football Tournament",
  },
  description:
    "Manage football tournaments, explore fixtures, follow live scores and view realtime match updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col bg-slate-950 text-white">
        <PublicNavbar />

        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
