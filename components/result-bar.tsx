"use client";

import { cn } from "@/lib/utils";

interface ResultsDisplayProps {
  leftName: string;
  rightName: string;
  leftPct: number;
  rightPct: number;
  leftIsWinner: boolean;
  n: number;
  className?: string;
}

export function ResultsDisplay({
  leftName,
  rightName,
  leftPct,
  rightPct,
  leftIsWinner,
  n,
  className,
}: ResultsDisplayProps) {
  const rightIsWinner = !leftIsWinner;

  return (
    <div
      className={cn("space-y-1.5 sm:space-y-2", className)}
      role="group"
      aria-label={`Voting results: ${leftName} ${leftPct}%, ${rightName} ${rightPct}%`}
    >
      {/* Labels row */}
      <div className="flex justify-between items-end opacity-0 animate-slide-up delay-1" style={{ animationFillMode: 'forwards' }}>
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span
            className={cn(
              "font-bold text-base sm:text-xl tabular-nums",
              leftIsWinner && "text-pop"
            )}
          >
            {leftPct}%
          </span>
          <span
            className={cn(
              "font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[120px]",
              leftIsWinner ? "text-pop" : "text-ink-light"
            )}
          >
            {leftName}
          </span>
        </div>
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span
            className={cn(
              "font-semibold text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[120px] text-right",
              rightIsWinner ? "text-pop" : "text-ink-light"
            )}
          >
            {rightName}
          </span>
          <span
            className={cn(
              "font-bold text-base sm:text-xl tabular-nums",
              rightIsWinner && "text-pop"
            )}
          >
            {rightPct}%
          </span>
        </div>
      </div>

      {/* Single combined bar */}
      <div
        className="h-6 sm:h-8 w-full flex rounded-md border-2 border-ink overflow-hidden opacity-0 animate-slide-up delay-2"
        style={{ animationFillMode: 'forwards' }}
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            leftIsWinner ? "bg-pop-light" : "bg-paper-dark"
          )}
          style={{ width: `${leftPct}%` }}
        />
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out border-l-2 border-ink",
            rightIsWinner ? "bg-pop-light" : "bg-paper-dark"
          )}
          style={{ width: `${rightPct}%` }}
        />
      </div>

      {/* Vote count */}
      <p className="text-center text-xs text-ink-light opacity-0 animate-slide-up delay-3" style={{ animationFillMode: 'forwards' }}>
        Based on <span className="font-semibold text-ink">{n.toLocaleString()}</span> vote{n !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
