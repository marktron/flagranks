const STORAGE_KEY = "flagranks_personal_stats";

export interface PersonalFlagStats {
  [flagId: number]: {
    wins: number;
    losses: number;
  };
}

export function getPersonalStats(): PersonalFlagStats {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function recordPersonalVote(winnerId: number, loserId: number): void {
  if (typeof window === "undefined") return;

  const stats = getPersonalStats();

  // Update winner stats
  if (!stats[winnerId]) {
    stats[winnerId] = { wins: 0, losses: 0 };
  }
  stats[winnerId].wins += 1;

  // Update loser stats
  if (!stats[loserId]) {
    stats[loserId] = { wins: 0, losses: 0 };
  }
  stats[loserId].losses += 1;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function clearPersonalStats(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getTotalPersonalVotes(): number {
  const stats = getPersonalStats();
  // Each vote creates 1 win + 1 loss, so total votes = total wins (or losses)
  return Object.values(stats).reduce((sum, s) => sum + s.wins, 0);
}
