"use client";

import Link from "next/link";
import { Eye, EyeOff, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "./settings-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Header() {
  const { settings, toggleShowNames } = useSettings();

  return (
    <header className="w-full border-b-2 border-ink bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🏁</span>
          <span className="text-xl sm:text-2xl font-bold tracking-tight group-hover:text-pop transition-colors">
            FlagRanks
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleShowNames}
                  className="relative"
                  aria-label={
                    settings.showNamesWhileVoting
                      ? "Hide country names while voting"
                      : "Show country names while voting"
                  }
                >
                  {settings.showNamesWhileVoting ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {settings.showNamesWhileVoting
                    ? "Names shown (accessibility mode)"
                    : "Names hidden until vote"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="ghost" size="sm" asChild>
            <Link href="/leaderboard" className="gap-2">
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
