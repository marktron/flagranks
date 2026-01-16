"use client";

import { cn } from "@/lib/utils";

interface ResultBarProps {
  countryName: string;
  percentage: number;
  isWinner: boolean;
  className?: string;
}

export function ResultBar({
  countryName,
  percentage,
  isWinner,
  className,
}: ResultBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-baseline mb-1.5">
        <span
          className={cn(
            "font-semibold text-sm sm:text-base truncate max-w-[60%]",
            isWinner && "text-pop"
          )}
        >
          {countryName}
        </span>
        <span
          className={cn(
            "font-bold text-lg sm:text-xl tabular-nums",
            isWinner && "text-pop"
          )}
        >
          {percentage}%
        </span>
      </div>
      <div className="result-bar">
        <div
          className={cn("result-bar-fill", isWinner && "winner")}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ResultsDisplayProps {
  aName: string;
  bName: string;
  aPct: number;
  bPct: number;
  n: number;
  winnerId: number;
  aId: number;
  className?: string;
}

export function ResultsDisplay({
  aName,
  bName,
  aPct,
  bPct,
  n,
  winnerId,
  aId,
  className,
}: ResultsDisplayProps) {
  const aIsWinner = winnerId === aId;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="opacity-0 animate-slide-up delay-1" style={{ animationFillMode: 'forwards' }}>
        <ResultBar
          countryName={aName}
          percentage={aPct}
          isWinner={aIsWinner}
        />
      </div>
      <div className="opacity-0 animate-slide-up delay-2" style={{ animationFillMode: 'forwards' }}>
        <ResultBar
          countryName={bName}
          percentage={bPct}
          isWinner={!aIsWinner}
        />
      </div>
      <p className="text-center text-sm text-ink-light opacity-0 animate-slide-up delay-3" style={{ animationFillMode: 'forwards' }}>
        Based on <span className="font-semibold text-ink">{n.toLocaleString()}</span> vote{n !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
