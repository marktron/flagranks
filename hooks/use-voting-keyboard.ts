import { useEffect } from "react";

interface UseVotingKeyboardOptions {
  onVoteLeft: () => void;
  onVoteRight: () => void;
  onAdvance: () => void;
  isResultShown: boolean;
  disabled?: boolean;
}

export function useVotingKeyboard({
  onVoteLeft,
  onVoteRight,
  onAdvance,
  isResultShown,
  disabled = false,
}: UseVotingKeyboardOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isResultShown) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          onVoteLeft();
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          onVoteRight();
        }
      } else {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          onAdvance();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onVoteLeft, onVoteRight, onAdvance, isResultShown, disabled]);
}
