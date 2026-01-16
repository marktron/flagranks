"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface FlagCardProps {
  id: number;
  svgUrl: string;
  countryName?: string;
  isSelected?: boolean;
  isRevealed?: boolean;
  isWinner?: boolean;
  onClick?: () => void;
  keyHint?: string;
  className?: string;
}

export function FlagCard({
  svgUrl,
  countryName,
  isSelected = false,
  isRevealed = false,
  isWinner = false,
  onClick,
  keyHint,
  className,
}: FlagCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isRevealed}
      className={cn(
        "sticker-card relative flex flex-col items-center p-2 sm:p-6",
        "cursor-pointer focus:outline-none",
        !isSelected && "focus-visible:ring-2 focus-visible:ring-pop focus-visible:ring-offset-2",
        "disabled:cursor-default disabled:hover:transform-none disabled:hover:shadow-[4px_4px_0_0_var(--ink),0_8px_24px_-8px_oklch(0.3_0.02_60_/_0.15)]",
        isSelected && "selected ring-0 ring-offset-0",
        className
      )}
    >
      {/* Flag image container */}
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg shadow-lg shadow-ink/10">
        <Image
          src={svgUrl}
          alt={isRevealed && countryName ? `Flag of ${countryName}` : "Flag"}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Country name - hidden until revealed, completely hidden on mobile pre-vote */}
      <div className={cn(
        "mt-3 sm:mt-4 h-7 sm:h-8 items-center justify-center",
        isRevealed ? "flex" : "hidden sm:flex"
      )}>
        {isRevealed && countryName ? (
          <span
            className={cn(
              "text-base sm:text-xl font-bold text-center animate-pop-in",
              isWinner && "text-pop"
            )}
          >
            {countryName}
          </span>
        ) : (
          <span className="text-sm text-ink-light font-medium">
            {keyHint ? (
              /* Desktop only: show keyboard hint */
              <span className="flex items-center gap-2">
                Press <span className="kbd-hint">{keyHint}</span>
              </span>
            ) : null}
          </span>
        )}
      </div>

      {/* Winner badge */}
      {isRevealed && isWinner && (
        <div className="absolute -top-3 -right-3 bg-pop text-primary-foreground text-xs font-bold px-2 py-1 rounded-full border-2 border-[oklch(0.45_0.12_195)] shadow-[2px_2px_0_0_oklch(0.35_0.10_195)] animate-pop-in">
          YOUR PICK
        </div>
      )}
    </button>
  );
}
