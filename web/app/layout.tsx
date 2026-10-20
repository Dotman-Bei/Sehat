import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sehat — bug bounties held in escrow on BOT Chain",
  description:
    "Sehat is an escrowed bug-bounty board on BOT Chain. Teams fund programmes in native BOT, researchers report privately, and accepted findings are paid on-chain.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
