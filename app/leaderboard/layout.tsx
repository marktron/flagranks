import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flag Rankings & Leaderboard | FlagRanks",
  description:
    "See which national flags rank highest based on global voting. Compare the best-designed flags from around the world.",
  openGraph: {
    title: "Flag Rankings & Leaderboard | FlagRanks",
    description:
      "See which national flags rank highest based on global voting. Compare the best-designed flags from around the world.",
    url: "https://flagranks.com/leaderboard",
  },
  twitter: {
    title: "Flag Rankings & Leaderboard | FlagRanks",
    description:
      "See which national flags rank highest based on global voting. Compare the best-designed flags from around the world.",
  },
  alternates: {
    canonical: "https://flagranks.com/leaderboard",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
