import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const description =
  "Create and manage permission-based email campaigns with contact verification, unsubscribe management, suppression controls, and scalable email delivery.";

export const metadata: Metadata = {
  metadataBase: new URL("https://campaign-monster.com"),
  title: "Campaign Monster — Email Marketing & Campaign Management Platform",
  description,
  openGraph: {
    title: "Campaign Monster — Email Marketing & Campaign Management Platform",
    description,
    url: "https://campaign-monster.com",
    siteName: "Campaign Monster",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campaign Monster — Email Marketing & Campaign Management Platform",
    description,
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
      >
        {children}
      </body>
    </html>
  );
}
