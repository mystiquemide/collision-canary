import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://collision-canary.vercel.app"),
  title: "Collision Canary",
  description:
    "Two real browsers, one last seat. Collision Canary proves only one user can win.",
  openGraph: {
    title: "Collision Canary",
    description:
      "Two real browsers, one last seat. Collision Canary proves only one user can win.",
    url: "https://collision-canary.vercel.app",
    siteName: "Collision Canary",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Collision Canary",
    description:
      "Two real browsers, one last seat. Collision Canary proves only one user can win.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
