"use client";

import { useCallback, useEffect, useState } from "react";
import { FlagCard } from "./flag-card";
import { ResultsDisplay } from "./result-bar";
import { Button } from "@/components/ui/button";
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

  // Auto-advance after 4 seconds when results are shown
  useEffect(() => {
    if (!result) return;

    const timer = setTimeout(() => {
      fetchMatchup();
    }, 4000);

    return () => clearTimeout(timer);
  }, [result, fetchMatchup]);

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-md mx-auto text-center px-4">
        <div className="text-6xl">🏁</div>
        <div>
          <h2 className="text-xl font-bold mb-2">Database Not Connected</h2>
          <p className="text-ink-light">
            The AWS PostgreSQL database only works when deployed to Vercel.
            Visit the production site to play!
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchMatchup} variant="outline">
            Retry
          </Button>
          <Button asChild>
            <a href="https://flagranks.vercel.app" target="_blank" rel="noopener noreferrer">
              Go to Production
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // Determine which flag is A based on the matchupId
  const [minId] = matchup.matchupId.split("-").map(Number);
  const aId = minId;

  // Get country names - only show after voting
  const getCountryName = (flag: typeof matchup.a) => {
    if (result) {
      return flag.id === aId ? result.pairing.aName : result.pairing.bName;
    }
    return undefined;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Question prompt */}
      <div className="text-center mb-4 sm:mb-12">
        <h2 className="text-xl sm:text-3xl md:text-4xl font-bold">
          Which flag is better?
        </h2>
        {voteCount > 0 && (
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-ink-light">
            You&apos;ve voted {voteCount} time{voteCount !== 1 ? "s" : ""} this session
          </p>
        )}
      </div>

      {/* Flag cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8 mb-4 sm:mb-8">
        <FlagCard
          id={matchup.a.id}
          svgUrl={matchup.a.svg_url}
          countryName={getCountryName(matchup.a)}
          isSelected={selectedId === matchup.a.id}
          isRevealed={!!result}
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
          isRevealed={!!result}
          isWinner={selectedId === matchup.b.id && !!result}
          onClick={() => vote(matchup.b.id)}
          keyHint={!result ? "→" : undefined}
          className="animate-pop-in delay-1"
        />
      </div>

      {/* Voting indicator */}
      {isVoting && (
        <div className="flex justify-center mb-4">
          <Loader2 className="w-5 h-5 animate-spin text-pop" />
        </div>
      )}

      {/* Results - Modal on mobile, inline card on desktop */}
      {result && (
        <>
          {/* Mobile: Tap anywhere overlay + Bottom sheet */}
          <div
            className="sm:hidden fixed inset-0 z-40"
            onClick={fetchMatchup}
          />
          <div
            className="sm:hidden fixed inset-x-0 bottom-0 z-50 p-3 pb-6 animate-sheet-up"
            onClick={fetchMatchup}
          >
            <div className="sticker-card p-4 w-full max-w-sm mx-auto">
              <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-3" />
              <h3 className="text-sm font-bold text-center mb-3">
                Community Results
              </h3>

              <ResultsDisplay
                leftName={matchup.a.id === aId ? result.pairing.aName : result.pairing.bName}
                rightName={matchup.b.id === aId ? result.pairing.aName : result.pairing.bName}
                leftPct={matchup.a.id === aId ? result.pairing.aPct : result.pairing.bPct}
                rightPct={matchup.b.id === aId ? result.pairing.aPct : result.pairing.bPct}
                leftIsWinner={selectedId === matchup.a.id}
                n={result.pairing.n}
              />

              <p className="text-center text-xs text-ink-light mt-3">
                Tap to continue
              </p>
            </div>
          </div>

          {/* Desktop: Inline card */}
          <div className="hidden sm:block sticker-card p-5 max-w-sm mx-auto animate-slide-up">
            <h3 className="text-base font-bold text-center mb-3">
              Community Results
            </h3>

            <ResultsDisplay
              leftName={matchup.a.id === aId ? result.pairing.aName : result.pairing.bName}
              rightName={matchup.b.id === aId ? result.pairing.aName : result.pairing.bName}
              leftPct={matchup.a.id === aId ? result.pairing.aPct : result.pairing.bPct}
              rightPct={matchup.b.id === aId ? result.pairing.aPct : result.pairing.bPct}
              leftIsWinner={selectedId === matchup.a.id}
              n={result.pairing.n}
            />

            <div className="mt-4 flex justify-center">
              <Button
                onClick={fetchMatchup}
                className="gap-2 font-bold"
                size="sm"
              >
                Next Matchup
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-center text-xs text-ink-light mt-2">
              Press <span className="kbd-hint text-[10px]">Enter</span> or{" "}
              <span className="kbd-hint text-[10px]">→</span> to continue
            </p>
          </div>
        </>
      )}
    </div>
  );
}
