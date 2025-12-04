// src/lib/scoring.ts

import type { GameConfig, GameOutcome } from './types';

type ScoreParams = {
  outcome: GameOutcome;
  safeRevealed: number;
  moves: number;
  minesHit: 0 | 1;
  config: GameConfig;
};

/**
 * Calculates the score for a single game round based on the rules.
 * @param params - The parameters for scoring.
 * @returns The calculated score.
 */
export function calculateScore({
  outcome,
  safeRevealed,
  moves,
  minesHit,
  config,
}: ScoreParams): number {
  const totalSafe = config.rows * config.cols - config.mineCount;
  const safeRatio = totalSafe > 0 ? safeRevealed / totalSafe : 0;

  let score: number;
  if (outcome === 'win') {
    // Higher score for winning with fewer moves
    score = 100 * safeRatio - 0.5 * (moves - 1);
  } else {
    // Penalize for hitting a mine
    score = 100 * safeRatio - 50 * minesHit; // Increased penalty for more impact
  }

  return Math.max(0, Math.round(score)); // Ensure score is not negative
}
