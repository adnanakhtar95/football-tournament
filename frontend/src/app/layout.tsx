// import type { Metadata } from "next";
// import {
//   Space_Grotesk,
//   Manrope,
//   Geist_Mono,
// } from "next/font/google";

// import PublicNavbarGate from "../components/PublicNavbarGate";

// import "./globals.css";

// const headingFont = Space_Grotesk({
//   variable: "--font-heading",
//   subsets: ["latin"],
//   display: "swap",
// });

// const bodyFont = Manrope({
//   variable: "--font-body",
//   subsets: ["latin"],
//   display: "swap",
// });

// const monoFont = Geist_Mono({
//   variable: "--font-code",
//   subsets: ["latin"],
//   display: "swap",
// });

// export const metadata: Metadata = {
//   title: {
//     default: "Football Cup | Tournament Platform",
//     template: "%s | Football Cup",
//   },
//   description:
//     "Explore football tournaments, follow live scores, discover players and experience real-time match updates.",
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html
//       lang="en"
//       className={`
//         ${headingFont.variable}
//         ${bodyFont.variable}
//         ${monoFont.variable}
//         antialiased
//       `}
//     >
//       <body className="min-h-screen bg-background text-foreground">
//         <PublicNavbarGate />

//         <div className="min-h-screen">{children}</div>
//       </body>
//     </html>
//   );
// }


import type { Metadata } from "next";

import {
  Space_Grotesk,
  Manrope,
  Geist_Mono,
} from "next/font/google";

import PublicNavbarGate from "../components/PublicNavbarGate";

import "./globals.css";

/* ==========================================
   TYPOGRAPHY
========================================== */

// Main headings across the public and admin UI
const headingFont = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Primary body typography
const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Secondary typography for codes, numbers, etc.
// Avoid preloading because it may not be used
// immediately on every page.
const monoFont = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/* ==========================================
   METADATA
========================================== */

export const metadata: Metadata = {
  title: {
    default: "Football Cup | Tournament Platform",
    template: "%s | Football Cup",
  },

  description:
    "Explore football tournaments, follow live scores, discover players and experience real-time match updates.",
};

/* ==========================================
   ROOT LAYOUT
========================================== */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`
        ${headingFont.variable}
        ${bodyFont.variable}
        ${monoFont.variable}
        antialiased
      `}
    >
      <body className="min-h-screen bg-background text-foreground">
        <PublicNavbarGate />

        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
