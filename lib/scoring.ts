/**
 * Bayesian smoothing constant.
 * Higher values pull scores toward 50% more strongly for flags with few games.
 */
export const SMOOTHING_K = 10;

/**
 * Calculate Bayesian-smoothed win rate.
 * Formula: (wins + K * 0.5) / (games + K)
 *
 * This prevents flags with few games from having extreme scores.
 * A flag with 0 games gets 50%, gradually approaching true win rate as games increase.
 *
 * @param wins - Number of wins
 * @param games - Total games played (wins + losses)
 * @returns Smoothed score between 0 and 1
 */
export function calculateSmoothedScore(wins: number, games: number): number {
  return (wins + SMOOTHING_K * 0.5) / (games + SMOOTHING_K);
}

/**
 * Calculate raw win percentage.
 * @param wins - Number of wins
 * @param games - Total games played
 * @returns Percentage (0-100) or 50 if no games played
 */
export function calculateRawWinPct(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 100) : 50;
}
