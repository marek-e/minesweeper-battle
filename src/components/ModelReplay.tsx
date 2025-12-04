// src/components/ModelReplay.tsx
'use client';

import React from 'react';
import type { BoardState, GameOutcome } from '@/lib/types';
import { BoardGrid } from './BoardGrid';

type ModelReplayProps = {
  modelId: string;
  board: BoardState;
  outcome: GameOutcome;
  moves: number;
  safeRevealed: number;
};

const outcomeStyles: Record<GameOutcome, string> = {
  win: 'text-green-600 bg-green-100 border-green-300',
  loss: 'text-red-600 bg-red-100 border-red-300',
  stuck: 'text-yellow-600 bg-yellow-100 border-yellow-300',
  error: 'text-gray-600 bg-gray-100 border-gray-300',
  playing: 'text-blue-600 bg-blue-100 border-blue-300',
};

export function ModelReplay({ modelId, board, outcome, moves, safeRevealed }: ModelReplayProps) {
  return (
    <div className="flex flex-col items-center p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold text-gray-800">{modelId}</h3>
      <div className="my-3">
        <BoardGrid board={board} />
      </div>
      <div className="flex justify-between w-full text-sm text-gray-600">
        <span
          className={`px-2 py-1 text-xs font-bold uppercase rounded-full border ${outcomeStyles[outcome]}`}
        >
          {outcome}
        </span>
        <span>Moves: {moves}</span>
        <span>Safe: {safeRevealed}</span>
      </div>
    </div>
  );
}