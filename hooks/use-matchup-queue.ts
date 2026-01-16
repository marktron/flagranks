import { useCallback, useRef, useState } from "react";
import type { Matchup } from "@/lib/types";

const BATCH_SIZE = 10;
const REFILL_THRESHOLD = 5;

export function useMatchupQueue() {
  const [queue, setQueue] = useState<Matchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const userFlagIdRef = useRef<number | null>(null);

  const fetchMatchups = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/matchups?count=${BATCH_SIZE}`);
      if (!res.ok) throw new Error("Failed to fetch matchups");
      const data: { userFlagId: number | null; matchups: Matchup[] } =
        await res.json();

      // Store user's flag ID (only on first fetch, it won't change)
      if (userFlagIdRef.current === null && data.userFlagId !== null) {
        userFlagIdRef.current = data.userFlagId;
      }

      setQueue((prev) => [...prev, ...data.matchups]);
    } catch (error) {
      console.error("Error fetching matchups:", error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const advance = useCallback(() => {
    setQueue((prev) => {
      const next = prev.slice(1);
      // Trigger refill if running low
      if (next.length < REFILL_THRESHOLD && !isFetchingRef.current) {
        fetchMatchups();
      }
      return next;
    });
  }, [fetchMatchups]);

  const currentMatchup = queue[0] ?? null;
  const userFlagId = userFlagIdRef.current;

  return {
    currentMatchup,
    userFlagId,
    isLoading,
    advance,
    fetchMatchups,
    queueLength: queue.length,
    updateCurrentStats: (stats: { aVotes: number; bVotes: number; n: number }) => {
      setQueue((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = { ...updated[0], stats };
        return updated;
      });
    },
  };
}
