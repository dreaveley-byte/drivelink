import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drivflo",
  description: "Vehicle delivery dispatch for CarbyClick",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Drivflo",
  },
};

export const viewport: Viewport = {
  themeColor: "#378ADD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
