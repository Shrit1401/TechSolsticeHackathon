import type { Metadata } from "next";
import { Inter, Michroma } from "next/font/google";
import "./globals.css";

const heroDisplay = Michroma({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-hero-display",
});

const uiSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "AI Observability — Control Center",
  description: "Real-time distributed system monitoring with anomaly detection, root cause analysis, and auto-remediation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full antialiased ${heroDisplay.variable} ${uiSans.variable}`}>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@300&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
