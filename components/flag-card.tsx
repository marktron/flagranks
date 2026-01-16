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
        "sticker-card relative flex flex-col items-center p-4 sm:p-6",
        "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-pop focus-visible:ring-offset-2",
        "disabled:cursor-default disabled:hover:transform-none disabled:hover:shadow-[4px_4px_0_0_var(--ink),0_8px_24px_-8px_oklch(0.3_0.02_60_/_0.15)]",
        isSelected && "selected",
        isWinner && isRevealed && "border-pop",
        className
      )}
    >
      {/* Flag image container */}
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-lg border-2 border-ink bg-paper-dark">
        <Image
          src={svgUrl}
          alt={isRevealed && countryName ? `Flag of ${countryName}` : "Flag"}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Country name - hidden until revealed */}
      <div className="mt-4 h-8 flex items-center justify-center">
        {isRevealed && countryName ? (
          <span
            className={cn(
              "text-lg sm:text-xl font-bold text-center animate-pop-in",
              isWinner && "text-pop"
            )}
          >
            {countryName}
          </span>
        ) : (
          <span className="text-sm text-ink-light font-medium">
            {keyHint ? (
              <span className="flex items-center gap-2">
                Press <span className="kbd-hint">{keyHint}</span>
              </span>
            ) : (
              "???"
            )}
          </span>
        )}
      </div>

      {/* Winner badge */}
      {isRevealed && isWinner && (
        <div className="absolute -top-3 -right-3 bg-pop text-primary-foreground text-xs font-bold px-2 py-1 rounded-full border-2 border-ink shadow-[2px_2px_0_0_var(--ink)] animate-pop-in">
          YOUR PICK
        </div>
      )}
    </button>
  );
}
