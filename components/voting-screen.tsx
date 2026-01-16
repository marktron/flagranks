"use client";

import { useCallback, useEffect, useState } from "react";
import { FlagCard } from "./flag-card";
import { ResultsDisplay } from "./result-bar";
import { Button } from "@/components/ui/button";
import { useSettings } from "./settings-provider";
import { ArrowRight, Loader2 } from "lucide-react";

interface Matchup {
  a: { id: number; svg_url: string; country_name: string };
  b: { id: number; svg_url: string; country_name: string };
  matchupId: string;
}

interface VoteResult {
  pairing: {
    aName: string;
    bName: string;
    aPct: number;
    bPct: number;
    n: number;
  };
  winner: { id: number; country_name: string };
  loser: { id: number; country_name: string };
}

const RECENT_PAIRS_KEY = "flagranks_recent_pairs";
const MAX_RECENT_PAIRS = 25;

function getRecentPairs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = sessionStorage.getItem(RECENT_PAIRS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentPair(matchupId: string) {
  const pairs = getRecentPairs();
  pairs.push(matchupId);
  if (pairs.length > MAX_RECENT_PAIRS) {
    pairs.shift();
  }
  sessionStorage.setItem(RECENT_PAIRS_KEY, JSON.stringify(pairs));
}

export function VotingScreen() {
  const { settings } = useSettings();
  const [matchup, setMatchup] = useState<Matchup | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [voteCount, setVoteCount] = useState(0);

  const fetchMatchup = useCallback(async () => {
    setIsLoading(true);
    setResult(null);
    setSelectedId(null);

    try {
      const recentPairs = getRecentPairs();
      const excludeIds = recentPairs.flatMap((p) => p.split("-").map(Number));
      const uniqueExclude = [...new Set(excludeIds)].slice(-10);

      const res = await fetch(
        `/api/matchup${uniqueExclude.length ? `?exclude=${uniqueExclude.join(",")}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch matchup");
      const data = await res.json();
      setMatchup(data);
    } catch (error) {
      console.error("Error fetching matchup:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const vote = useCallback(
    async (winnerId: number) => {
      if (!matchup || isVoting || result) return;

      setSelectedId(winnerId);
      setIsVoting(true);

      const loserId = winnerId === matchup.a.id ? matchup.b.id : matchup.a.id;

      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId, loserId }),
        });

        if (!res.ok) throw new Error("Failed to record vote");

        const data = await res.json();
        setResult(data);
        setVoteCount((c) => c + 1);
        addRecentPair(matchup.matchupId);
      } catch (error) {
        console.error("Error voting:", error);
        setSelectedId(null);
      } finally {
        setIsVoting(false);
      }
    },
    [matchup, isVoting, result]
  );

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchup) return;

      if (!result) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          vote(matchup.a.id);
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          vote(matchup.b.id);
        }
      } else {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          fetchMatchup();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [matchup, result, vote, fetchMatchup]);

  // Initial load
  useEffect(() => {
    fetchMatchup();
  }, [fetchMatchup]);

  if (isLoading && !matchup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-pop" />
        <p className="text-ink-light font-medium">Loading matchup...</p>
      </div>
    );
  }

  if (!matchup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-ink-light font-medium">
          Could not load matchup. Please try again.
        </p>
        <Button onClick={fetchMatchup}>Retry</Button>
      </div>
    );
  }

  // Determine which flag is A based on the matchupId
  const [minId] = matchup.matchupId.split("-").map(Number);
  const aId = minId;

  // Get country names - show from matchup if accessibility mode, otherwise from result
  const getCountryName = (flag: typeof matchup.a) => {
    if (result) {
      // After voting, show from result
      return flag.id === aId ? result.pairing.aName : result.pairing.bName;
    }
    if (settings.showNamesWhileVoting) {
      // Accessibility mode - show from matchup
      return flag.country_name;
    }
    return undefined;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Question prompt */}
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold star-accent">
          Which flag is better designed?
        </h2>
        {voteCount > 0 && (
          <p className="mt-2 text-sm text-ink-light">
            You&apos;ve voted {voteCount} time{voteCount !== 1 ? "s" : ""} this session
          </p>
        )}
      </div>

      {/* Flag cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
        <FlagCard
          id={matchup.a.id}
          svgUrl={matchup.a.svg_url}
          countryName={getCountryName(matchup.a)}
          isSelected={selectedId === matchup.a.id}
          isRevealed={!!result || settings.showNamesWhileVoting}
          isWinner={selectedId === matchup.a.id && !!result}
          onClick={() => vote(matchup.a.id)}
          keyHint={!result ? "←" : undefined}
          className="animate-pop-in"
        />
        <FlagCard
          id={matchup.b.id}
          svgUrl={matchup.b.svg_url}
          countryName={getCountryName(matchup.b)}
          isSelected={selectedId === matchup.b.id}
          isRevealed={!!result || settings.showNamesWhileVoting}
          isWinner={selectedId === matchup.b.id && !!result}
          onClick={() => vote(matchup.b.id)}
          keyHint={!result ? "→" : undefined}
          className="animate-pop-in delay-1"
        />
      </div>

      {/* Voting indicator */}
      {isVoting && (
        <div className="flex justify-center mb-6">
          <Loader2 className="w-5 h-5 animate-spin text-pop" />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="sticker-card p-6 sm:p-8 max-w-md mx-auto animate-slide-up">
          <h3 className="text-lg font-bold text-center mb-6">
            Community Results
          </h3>

          <ResultsDisplay
            aName={result.pairing.aName}
            bName={result.pairing.bName}
            aPct={result.pairing.aPct}
            bPct={result.pairing.bPct}
            n={result.pairing.n}
            winnerId={selectedId!}
            aId={aId}
          />

          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={fetchMatchup}
              className="gap-2 font-bold text-base"
            >
              Next Matchup
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-center text-xs text-ink-light mt-4">
            Press <span className="kbd-hint text-[10px]">Enter</span> or{" "}
            <span className="kbd-hint text-[10px]">→</span> to continue
          </p>
        </div>
      )}
    </div>
  );
}
