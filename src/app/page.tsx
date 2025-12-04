// src/app/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { runSimulation } from './actions';
import { calculateScore } from '@/lib/scoring';
import type { GameConfig, GameResult, ReplayFrame } from '@/lib/types';
import { ReplayContainer } from '@/components/ReplayContainer';
import { RankingTable } from '@/components/RankingTable';

// --- Config ---
const MODELS_TO_TEST = [
  'gpt-4o',
  'gpt-4-turbo',
  // 'claude-3-5-sonnet-20240620', // Add models supported by your provider
];

const GAME_CONFIG: GameConfig = {
  rows: 8,
  cols: 8,
  mineCount: 10,
};

const OUTCOME_ORDER: Record<GameResult['outcome'], number> = {
  win: 1,
  stuck: 2,
  loss: 3,
  error: 4,
  playing: 5,
};

type SimulationData = {
  result: Omit<GameResult, 'score' | 'totalSafe' | 'minesHit'> & { minesHit: 0 | 1 };
  replayLog: ReplayFrame[];
};

export default function Home() {
  const [simulations, setSimulations] = useState<SimulationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartBattle = async () => {
    setIsLoading(true);
    setError(null);
    setSimulations([]);

    try {
      // The runSimulation action needs to be updated to return minesHit
      // For now, we'll assume it's part of the result object.
      // This will require a small change in `actions.ts`.
      const results = await Promise.all(
        MODELS_TO_TEST.map(modelId => runSimulation(modelId, GAME_CONFIG))
      );
      // @ts-ignore // Assuming the action is updated
      setSimulations(results);
    } catch (err) {
      console.error('Simulation failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const rankedResults = useMemo((): GameResult[] => {
    if (simulations.length === 0) return [];

    const fullResults: GameResult[] = simulations.map(({ result, replayLog }) => {
      const lastFrame = replayLog[replayLog.length - 1];
      const minesHit = lastFrame.boardState.flat().filter(c => c.isMine && c.isRevealed).length > 0 ? 1 : 0;
      
      const score = calculateScore({
        outcome: result.outcome,
        safeRevealed: result.safeRevealed,
        moves: result.moves,
        minesHit: minesHit,
        config: GAME_CONFIG,
      });

      return {
        ...result,
        score,
        totalSafe: GAME_CONFIG.rows * GAME_CONFIG.cols - GAME_CONFIG.mineCount,
        minesHit,
      };
    });

    return fullResults.sort((a, b) => {
      // 1. Score (desc)
      if (a.score !== b.score) return b.score - a.score;
      // 2. Outcome priority
      if (OUTCOME_ORDER[a.outcome] !== OUTCOME_ORDER[b.outcome]) {
        return OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome];
      }
      // 3. Moves (asc)
      if (a.moves !== b.moves) return a.moves - b.moves;
      // 4. Duration (asc)
      return a.durationMs - b.durationMs;
    });
  }, [simulations]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50 text-gray-800">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Minesweeper Battle
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            LLM agents compete on the same board to solve Minesweeper.
          </p>
        </header>

        <div className="flex justify-center mb-8">
          <button
            onClick={handleStartBattle}
            disabled={isLoading}
            className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Simulating...' : 'Start Battle'}
          </button>
        </div>

        {error && (
          <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {rankedResults.length > 0 && <RankingTable results={rankedResults} />}

        {simulations.length > 0 && (
          <div className="mt-12">
            <ReplayContainer simulations={simulations as any} />
          </div>
        )}
      </div>
    </main>
  );
}