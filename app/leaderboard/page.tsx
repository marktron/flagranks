"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, Share2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlagWithStats {
  id: number;
  country_name: string;
  iso2: string;
  svg_url: string;
  wins: number;
  losses: number;
  games: number;
  smoothed_score: number;
  raw_win_pct: number;
}

export default function LeaderboardPage() {
  const [flags, setFlags] = useState<FlagWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setFlags(data.flags);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      console.log("Could not copy to clipboard");
    }
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-2xl";
    if (rank === 2) return "text-xl";
    if (rank === 3) return "text-lg";
    return "text-base";
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-pop" />
        <p className="text-ink-light font-medium">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-ink-light hover:text-ink transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to voting
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8 text-pop" />
            Leaderboard
          </h1>
          <p className="text-ink-light mt-1">
            Ranked by design score (Bayesian smoothed)
          </p>
        </div>

        <Button variant="outline" onClick={handleShare} className="gap-2">
          <Share2 className="w-4 h-4" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>

      {/* Leaderboard table */}
      <div className="sticker-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-ink bg-paper-dark/50">
                <th className="text-left py-3 px-4 font-bold text-sm">#</th>
                <th className="text-left py-3 px-4 font-bold text-sm">Flag</th>
                <th className="text-left py-3 px-4 font-bold text-sm">
                  Country
                </th>
                <th className="text-right py-3 px-4 font-bold text-sm">
                  Score
                </th>
                <th className="text-right py-3 px-4 font-bold text-sm hidden sm:table-cell">
                  Win %
                </th>
                <th className="text-right py-3 px-4 font-bold text-sm hidden sm:table-cell">
                  Games
                </th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, index) => {
                const rank = index + 1;
                const emoji = getRankEmoji(rank);

                return (
                  <tr
                    key={flag.id}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-paper-dark/30 transition-colors",
                      rank <= 3 && "bg-pop-light/10"
                    )}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          getRankStyle(rank),
                          rank <= 3 && "text-pop"
                        )}
                      >
                        {emoji || rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-12 h-8 relative rounded border border-ink overflow-hidden">
                        <Image
                          src={flag.svg_url}
                          alt={`Flag of ${flag.country_name}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "font-medium",
                          rank <= 3 && "font-bold"
                        )}
                      >
                        {flag.country_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          rank <= 3 && "text-pop"
                        )}
                      >
                        {(flag.smoothed_score * 100).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="tabular-nums text-ink-light">
                        {flag.games > 0 ? `${flag.raw_win_pct}%` : "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="tabular-nums text-ink-light">
                        {flag.games.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {flags.length === 0 && (
          <div className="py-12 text-center text-ink-light">
            <p>No votes recorded yet. Be the first to vote!</p>
            <Button asChild className="mt-4">
              <Link href="/">Start Voting</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 text-sm text-ink-light text-center">
        <p>
          <strong>Score</strong> = Bayesian-smoothed win rate (accounts for
          sample size)
        </p>
      </div>
    </div>
  );
}
