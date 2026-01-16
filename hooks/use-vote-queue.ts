import { useCallback, useEffect, useRef, useState } from "react";
import type { PendingVote } from "@/lib/types";

interface QueuedVote extends PendingVote {
  timestamp: number;
  retryCount: number;
}

export interface VoteQueueState {
  pending: number;
  failed: number;
  isRetrying: boolean;
  lastError: string | null;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const FLUSH_THRESHOLD = 5;
const STORAGE_KEY = "flagranks_pending_votes";

export function useVoteQueue() {
  const queueRef = useRef<QueuedVote[]>([]);
  const failedRef = useRef<QueuedVote[]>([]);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<VoteQueueState>({
    pending: 0,
    failed: 0,
    isRetrying: false,
    lastError: null,
  });

  // Load any persisted failed votes on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const votes = JSON.parse(stored) as QueuedVote[];
        if (votes.length > 0) {
          queueRef.current = votes.map((v) => ({ ...v, retryCount: 0 }));
          localStorage.removeItem(STORAGE_KEY);
          updateState();
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const updateState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pending: queueRef.current.length,
      failed: failedRef.current.length,
      isRetrying: retryTimeoutRef.current !== null,
    }));
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current || queueRef.current.length === 0) return;

    const minRetryCount = Math.min(
      ...queueRef.current.map((v) => v.retryCount),
      MAX_RETRIES
    );
    const delay = BASE_DELAY_MS * Math.pow(2, minRetryCount);

    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null;
      flush();
    }, delay);

    updateState();
  }, [updateState]);

  const flush = useCallback(
    async (useBeacon = false): Promise<boolean> => {
      const votes = [...queueRef.current];
      if (votes.length === 0) return true;

      // Clear queue immediately to prevent double-send
      queueRef.current = [];
      updateState();

      const payload = JSON.stringify({
        votes: votes.map((v) => ({ winnerId: v.winnerId, loserId: v.loserId })),
      });

      if (useBeacon && navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
          "/api/votes",
          new Blob([payload], { type: "application/json" })
        );
        if (!sent) {
          // Beacon failed, persist to localStorage for next session
          persistFailedVotes(votes);
        }
        return sent;
      }

      try {
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        setState((s) => ({ ...s, lastError: null }));
        return true;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Network error";
        setState((s) => ({ ...s, lastError: errorMsg }));

        // Increment retry counts and re-queue or move to failed
        for (const vote of votes) {
          if (vote.retryCount < MAX_RETRIES) {
            queueRef.current.push({ ...vote, retryCount: vote.retryCount + 1 });
          } else {
            failedRef.current.push(vote);
          }
        }
        updateState();
        scheduleRetry();
        return false;
      }
    },
    [updateState, scheduleRetry]
  );

  const addVote = useCallback(
    (winnerId: number, loserId: number) => {
      queueRef.current.push({
        winnerId,
        loserId,
        timestamp: Date.now(),
        retryCount: 0,
      });
      updateState();

      // Auto-flush if we hit the threshold
      if (queueRef.current.length >= FLUSH_THRESHOLD) {
        flush();
      }
    },
    [updateState, flush]
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, lastError: null }));
  }, []);

  const retryFailed = useCallback(() => {
    // Move failed votes back to queue for retry
    queueRef.current.push(
      ...failedRef.current.map((v) => ({ ...v, retryCount: 0 }))
    );
    failedRef.current = [];
    updateState();
    flush();
  }, [flush, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      // Persist any remaining votes
      if (queueRef.current.length > 0 || failedRef.current.length > 0) {
        persistFailedVotes([...queueRef.current, ...failedRef.current]);
      }
    };
  }, []);

  return {
    addVote,
    flush,
    retryFailed,
    clearError,
    state,
    pendingCount: queueRef.current.length,
  };
}

// Persist failed votes to localStorage for recovery
function persistFailedVotes(votes: QueuedVote[]) {
  try {
    const existing = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    ) as QueuedVote[];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...existing, ...votes].slice(-100))
    );
  } catch {
    // Ignore localStorage errors
  }
}
