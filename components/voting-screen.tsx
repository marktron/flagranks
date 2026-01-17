"use client";

import { useCallback, useEffect, useState } from "react";
import { FlagCard } from "./flag-card";
import { ResultsDisplay } from "./result-bar";
import { VoteErrorToast } from "./vote-error-toast";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { recordPersonalVote } from "@/lib/personal-stats";
import { useMatchupQueue } from "@/hooks/use-matchup-queue";
import { useVoteQueue } from "@/hooks/use-vote-queue";
import { useVotingKeyboard } from "@/hooks/use-voting-keyboard";
import { usePageVisibility } from "@/hooks/use-page-visibility";
import type { Matchup, OptimisticResult } from "@/lib/types";

interface VotingScreenProps {
  initialMatchups?: Matchup[];
}

export function VotingScreen({ initialMatchups }: VotingScreenProps) {
  const [result, setResult] = useState<OptimisticResult | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voteCount, setVoteCount] = useState(0);

  const {
    currentMatchup,
    userFlagId,
    isLoading,
    advance,
    fetchMatchups,
    updateCurrentStats,
  } = useMatchupQueue(initialMatchups);

  const { addVote, flush, retryFailed, clearError, state: voteQueueState } = useVoteQueue();

  // Advance to next matchup
  const advanceToNext = useCallback(() => {
    setResult(null);
    setSelectedId(null);
    advance();
  }, [advance]);

  // Vote handler with optimistic updates
  const vote = useCallback(
    (winnerId: number) => {
      if (!currentMatchup || result) return;

      const loserId = winnerId === currentMatchup.a.id ? currentMatchup.b.id : currentMatchup.a.id;

      // Check if this matchup involves the user's own flag
      const involvesUserFlag =
        userFlagId !== null &&
        (currentMatchup.a.id === userFlagId || currentMatchup.b.id === userFlagId);

      // Only send to server if it doesn't involve user's flag
      if (!involvesUserFlag) {
        addVote(winnerId, loserId);
      }

      // Always record personal vote in localStorage
      recordPersonalVote(winnerId, loserId);

      // Calculate optimistic stats
      const [minId] = currentMatchup.matchupId.split("-").map(Number);
      const winnerIsA = winnerId === minId;
      const newAVotes = currentMatchup.stats.aVotes + (winnerIsA ? 1 : 0);
      const newBVotes = currentMatchup.stats.bVotes + (winnerIsA ? 0 : 1);
      const newN = currentMatchup.stats.n + 1;

      // Update the matchup's stats for future reference
      updateCurrentStats({ aVotes: newAVotes, bVotes: newBVotes, n: newN });

      // Calculate percentages
      const aPct = newN > 0 ? Math.round((newAVotes / newN) * 100) : 50;
      const bPct = newN > 0 ? Math.round((newBVotes / newN) * 100) : 50;

      setSelectedId(winnerId);
      setResult({
        aName: currentMatchup.a.country_name,
        bName: currentMatchup.b.country_name,
        aPct: currentMatchup.a.id === minId ? aPct : bPct,
        bPct: currentMatchup.b.id === minId ? aPct : bPct,
        n: newN,
        winnerId,
      });
      setVoteCount((c) => c + 1);
    },
    [currentMatchup, result, userFlagId, addVote, updateCurrentStats]
  );

  // Keyboard support
  useVotingKeyboard({
    onVoteLeft: () => currentMatchup && vote(currentMatchup.a.id),
    onVoteRight: () => currentMatchup && vote(currentMatchup.b.id),
    onAdvance: advanceToNext,
    isResultShown: !!result,
    disabled: !currentMatchup,
  });

  // Initial load - only fetch if no initial matchups provided (SSR case)
  useEffect(() => {
    if (!initialMatchups?.length) {
      fetchMatchups();
    }
  }, [fetchMatchups, initialMatchups]);

  // Auto-advance after 4 seconds when results are shown
  useEffect(() => {
    if (!result) return;

    const timer = setTimeout(() => {
      advanceToNext();
    }, 4000);

    return () => clearTimeout(timer);
  }, [result, advanceToNext]);

  // Flush votes on visibility change and page unload
  usePageVisibility(() => flush(true));

  // Flush any remaining votes on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  if (isLoading && !currentMatchup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-pop" />
        <p className="text-ink-light font-medium">Loading matchups...</p>
      </div>
    );
  }

  if (!currentMatchup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 max-w-md mx-auto text-center px-4">
        <div className="text-6xl">🏁</div>
        <div>
          <h2 className="text-xl font-bold mb-2">Database Not Connected</h2>
          <p className="text-ink-light">
            The AWS PostgreSQL database only works when deployed to Vercel. Visit the production
            site to play!
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchMatchups} variant="outline">
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

  // Get country names - only show after voting
  const getCountryName = (flag: typeof currentMatchup.a) => {
    if (result) {
      return flag.country_name;
    }
    return undefined;
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Question prompt */}
      <div className="text-center mb-4 sm:mb-12">
        <h2 className="text-xl sm:text-3xl md:text-4xl font-bold">Which flag is better?</h2>
        {voteCount > 0 && (
          <p
            className="mt-1 sm:mt-2 text-xs sm:text-sm text-ink-light"
            aria-live="polite"
            aria-atomic="true"
          >
            You&apos;ve voted {voteCount} time{voteCount !== 1 ? "s" : ""} this session
          </p>
        )}
      </div>

      {/* Flag cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8 mb-4 sm:mb-8">
        <FlagCard
          id={currentMatchup.a.id}
          svgUrl={currentMatchup.a.svg_url}
          countryName={getCountryName(currentMatchup.a)}
          isSelected={selectedId === currentMatchup.a.id}
          isRevealed={!!result}
          isWinner={selectedId === currentMatchup.a.id && !!result}
          onClick={() => vote(currentMatchup.a.id)}
          keyHint={!result ? "←" : undefined}
          className="animate-pop-in"
          position="left"
        />
        <FlagCard
          id={currentMatchup.b.id}
          svgUrl={currentMatchup.b.svg_url}
          countryName={getCountryName(currentMatchup.b)}
          isSelected={selectedId === currentMatchup.b.id}
          isRevealed={!!result}
          isWinner={selectedId === currentMatchup.b.id && !!result}
          onClick={() => vote(currentMatchup.b.id)}
          keyHint={!result ? "→" : undefined}
          className="animate-pop-in delay-1"
          mobileNameAbove
          position="right"
        />
      </div>

      {/* Results - Modal on mobile, inline card on desktop */}
      {result && (
        <>
          {/* Mobile: Bottom sheet dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-heading-mobile"
            className="sm:hidden fixed inset-0 z-40 flex flex-col justify-end"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 -z-10"
              onClick={advanceToNext}
              aria-hidden="true"
            />
            <div className="p-3 pb-6 animate-sheet-up">
              <div className="sticker-card p-4 w-full">
                <div
                  className="w-10 h-1 bg-ink/20 rounded-full mx-auto mb-3"
                  aria-hidden="true"
                />
                <h3 id="results-heading-mobile" className="text-sm font-bold text-center mb-3">
                  Global Results
                </h3>

                <ResultsDisplay
                  leftName={result.aName}
                  rightName={result.bName}
                  leftPct={result.aPct}
                  rightPct={result.bPct}
                  leftIsWinner={selectedId === currentMatchup.a.id}
                  n={result.n}
                />

                <button
                  onClick={advanceToNext}
                  className="w-full text-center text-xs text-ink-light mt-3 py-2 hover:text-ink transition-colors"
                >
                  Tap to continue
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: Inline card */}
          <div className="hidden sm:block sticker-card p-5 max-w-sm mx-auto animate-slide-up">
            <h3 className="text-base font-bold text-center mb-3">Global Results</h3>

            <ResultsDisplay
              leftName={result.aName}
              rightName={result.bName}
              leftPct={result.aPct}
              rightPct={result.bPct}
              leftIsWinner={selectedId === currentMatchup.a.id}
              n={result.n}
            />

            <div className="mt-4 flex justify-center">
              <Button onClick={advanceToNext} className="gap-2 font-bold" size="sm">
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

      {/* Error toast for failed votes */}
      {voteQueueState.lastError && voteQueueState.failed > 0 && (
        <VoteErrorToast
          message={voteQueueState.lastError}
          failedCount={voteQueueState.failed}
          onRetry={retryFailed}
          onDismiss={clearError}
        />
      )}
    </div>
  );
}
