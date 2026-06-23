import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniwave Go Freight",
  description: "Internal application foundation for shipping note operations.",
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
