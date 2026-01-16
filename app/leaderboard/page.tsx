"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Trophy, User, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getPersonalStats,
  getTotalPersonalVotes,
  type PersonalFlagStats,
} from "@/lib/personal-stats";
import { calculateSmoothedScore } from "@/lib/scoring";
import type { FlagWithStats } from "@/lib/types";

type ViewMode = "global" | "personal";

export default function LeaderboardPage() {
  const [globalFlags, setGlobalFlags] = useState<FlagWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("global");
  const [personalStats, setPersonalStats] = useState<PersonalFlagStats>({});
  const [totalPersonalVotes, setTotalPersonalVotes] = useState(0);

  // Fetch global leaderboard
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setGlobalFlags(data.flags);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  // Load personal stats from localStorage
  useEffect(() => {
    setPersonalStats(getPersonalStats());
    setTotalPersonalVotes(getTotalPersonalVotes());
  }, []);

  // Build personal leaderboard from stats
  const personalFlags: FlagWithStats[] = globalFlags
    .filter((flag) => personalStats[flag.id])
    .map((flag) => {
      const stats = personalStats[flag.id];
      const wins = stats.wins;
      const losses = stats.losses;
      const games = wins + losses;
      return {
        ...flag,
        wins,
        losses,
        games,
        smoothed_score: calculateSmoothedScore(wins, games),
        raw_win_pct: games > 0 ? Math.round((wins / games) * 100) : 50,
      };
    })
    .sort((a, b) => b.smoothed_score - a.smoothed_score);

  const flags = viewMode === "global" ? globalFlags : personalFlags;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
          <Trophy className="w-8 h-8 text-pop" />
          Leaderboard
        </h1>

        <div
          role="group"
          aria-label="Leaderboard view"
          className="inline-flex rounded-lg border-2 border-ink p-1 bg-paper"
        >
          <button
            onClick={() => setViewMode("global")}
            aria-pressed={viewMode === "global"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all",
              viewMode === "global"
                ? "bg-ink text-paper shadow-sm"
                : "text-ink-light hover:text-ink"
            )}
          >
            <Globe className="w-4 h-4" aria-hidden="true" />
            Global
          </button>
          <button
            onClick={() => setViewMode("personal")}
            aria-pressed={viewMode === "personal"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all",
              viewMode === "personal"
                ? "bg-ink text-paper shadow-sm"
                : "text-ink-light hover:text-ink"
            )}
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Personal
          </button>
        </div>
      </div>

      {/* Personal stats summary */}
      {viewMode === "personal" && totalPersonalVotes > 0 && (
        <div className="text-sm text-ink-light mb-4">
          Based on your {totalPersonalVotes.toLocaleString()} vote{totalPersonalVotes !== 1 ? "s" : ""}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="sticker-card sticker-card-static overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">
              {viewMode === "global" ? "Global flag rankings" : "Your personal flag rankings"}
            </caption>
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
                      <div className="w-12 h-8 relative rounded shadow-sm shadow-ink/10 overflow-hidden">
                        <Image
                          src={flag.svg_url}
                          alt={`Flag of ${flag.country_name}`}
                          fill
                          className="object-cover saturate-[1.2]"
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

        {/* Empty states */}
        {viewMode === "global" && globalFlags.length === 0 && !isLoading && (
          <div className="py-12 text-center">
            <div className="text-5xl mb-4">🏁</div>
            <p className="text-ink-light mb-4">
              {process.env.NODE_ENV === "development"
                ? "Database not available locally. Visit production to see the leaderboard."
                : "No votes recorded yet. Be the first to vote!"}
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link href="/">Start Voting</Link>
              </Button>
              <Button asChild>
                <a href="https://flagranks.vercel.app/leaderboard" target="_blank" rel="noopener noreferrer">
                  View Production
                </a>
              </Button>
            </div>
          </div>
        )}

        {viewMode === "personal" && personalFlags.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-5xl mb-4">🗳️</div>
            <p className="text-ink-light mb-4">
              You haven&apos;t voted yet. Start voting to see your personal rankings!
            </p>
            <Button asChild>
              <Link href="/">Start Voting</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 text-sm text-ink-light text-center">
        <p>
          <strong>Score</strong> = Bayesian-smoothed win rate (accounts for
          sample size variations)
        </p>
      </div>
    </div>
  );
}
