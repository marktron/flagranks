import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { SettingsProvider } from "@/components/settings-provider";

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
    "Which flag is better designed? Vote on national flags and see how your taste compares to the community.",
  openGraph: {
    title: "FlagRanks - Vote on Flag Design",
    description:
      "Which flag is better designed? Vote on national flags and see how your taste compares to the community.",
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
      <body className="antialiased min-h-screen flex flex-col">
        <SettingsProvider>
          {/* Paper texture overlay */}
          <div className="fixed inset-0 paper-texture pointer-events-none" />

          <Header />

          <main className="flex-1 relative">{children}</main>

          {/* Footer */}
          <footer className="border-t-2 border-ink py-6 mt-auto">
            <div className="max-w-6xl mx-auto px-4 text-center text-sm text-ink-light">
              <p>
                Comparing {193} UN member flags{" "}
                <span className="text-pop">✦</span> No accounts required
              </p>
            </div>
          </footer>
        </SettingsProvider>
      </body>
    </html>
  );
}
