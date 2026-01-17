import { useCallback, useEffect, useRef, useState } from "react";
import type { Matchup } from "@/lib/types";

const BATCH_SIZE = 10;
const REFILL_THRESHOLD = 5;
const MAX_SEEN_IDS = 100;

export function useMatchupQueue(initialMatchups?: Matchup[]) {
  const [queue, setQueue] = useState<Matchup[]>(initialMatchups ?? []);
  const [isLoading, setIsLoading] = useState(!initialMatchups?.length);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(!!initialMatchups?.length);
  const isFetchingRef = useRef(false);
  const userFlagIdRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(
    new Set(initialMatchups?.map((m) => m.matchupId))
  );

  const fetchMatchups = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/matchups?count=${BATCH_SIZE}`);
      if (!res.ok) throw new Error("Failed to fetch matchups");
      const data: { userFlagId: number | null; matchups: Matchup[] } =
        await res.json();

      if (userFlagIdRef.current === null && data.userFlagId !== null) {
        userFlagIdRef.current = data.userFlagId;
      }

      // Filter out recently seen matchups
      const newMatchups = data.matchups.filter(
        (m) => !seenIdsRef.current.has(m.matchupId)
      );

      // Track new matchup IDs
      newMatchups.forEach((m) => seenIdsRef.current.add(m.matchupId));

      // Trim seen set if too large (keep most recent)
      if (seenIdsRef.current.size > MAX_SEEN_IDS) {
        const entries = Array.from(seenIdsRef.current);
        seenIdsRef.current = new Set(entries.slice(-MAX_SEEN_IDS));
      }

      if (newMatchups.length > 0) {
        setHasLoadedOnce(true);
        setQueue((prev) => [...prev, ...newMatchups]);
      }
    } catch (error) {
      console.error("Error fetching matchups:", error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch when queue is empty but we've loaded before
  useEffect(() => {
    if (hasLoadedOnce && queue.length === 0 && !isFetchingRef.current) {
      fetchMatchups();
    }
  }, [hasLoadedOnce, queue.length, fetchMatchups]);

  const advance = useCallback(() => {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length < REFILL_THRESHOLD && !isFetchingRef.current) {
        fetchMatchups();
      }
      return next;
    });
  }, [fetchMatchups]);

  const currentMatchup = queue[0] ?? null;

  return {
    currentMatchup,
    userFlagId: userFlagIdRef.current,
    isLoading,
    hasLoadedOnce,
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
