import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || ""
  ),

  title: {
    default: "Vellko Affiliate",
    template: "%s | Vellko Affiliate",
  },

  description:
    "Join the Vellko Affiliate Network and start earning today. High converting offers, timely payments, and dedicated support.",

  openGraph: {
    title: "Vellko Affiliate",
    description:
      "Join the Vellko Affiliate Network and start earning today.",
    url: "/",
    siteName: "Vellko Affiliate",
    locale: "en_US",
    type: "website",

    // ✅ ADD THIS
    images: [
      {
        url: "/opengraph-image", // Next.js will convert to full URL using metadataBase
        width: 1200,
        height: 630,
        alt: "Vellko Affiliate",
      },
    ],
  },

  twitter: {
    title: "Vellko Affiliate",
    description:
      "Join the Vellko Affiliate Network and start earning today.",
    card: "summary_large_image",

    // ✅ ADD THIS
    images: ["/opengraph-image"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
