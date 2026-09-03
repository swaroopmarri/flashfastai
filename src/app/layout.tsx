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
  "Upload contacts, verify every email before you send, and run compliant email campaigns — all in one platform.";

export const metadata: Metadata = {
  metadataBase: new URL("https://campaign-monster.com"),
  title: "Campaign Monster",
  description,
  openGraph: {
    title: "Campaign Monster",
    description,
    url: "https://campaign-monster.com",
    siteName: "Campaign Monster",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campaign Monster",
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
