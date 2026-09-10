import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniwave Go Freight",
  description: "Internal application foundation for shipping note operations.",
};

const themeInitScript = `(function(){try{var s=localStorage.getItem("uniwave-theme");var m=(s==="light"||s==="dark"||s==="system")?s:"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
