import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/header";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlagRanks - Vote on Flag Design",
  description:
    "Which flag is better designed? Vote on national flags and see how your taste compares to the rest of the world.",
  openGraph: {
    title: "FlagRanks - Vote on Flag Design",
    description:
      "Which flag is better designed? Vote on national flags and see how your taste compares to the rest of the world.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable}`}>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-CC252VXG7R"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CC252VXG7R');
        `}
      </Script>
      <body className="antialiased min-h-screen flex flex-col">
        {/* Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-pop focus:text-primary-foreground focus:rounded-md focus:font-bold"
        >
          Skip to main content
        </a>

        {/* Paper texture overlay */}
        <div className="fixed inset-0 paper-texture pointer-events-none" aria-hidden="true" />

        <Header />

        <main id="main-content" className="flex-1 relative">{children}</main>

        {/* Footer */}
        <footer className="py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-ink-light">
            <p>
             🇨🇦 Made by <a href="https://markallen.io" target="_blank" rel="noopener noreferrer" className="text-pop underline hover:no-underline">Mark Allen</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
