// src/components/RankingTable.tsx
'use client';

import React from 'react';
import type { GameResult } from '@/lib/types';

type RankingTableProps = {
  results: GameResult[];
};

const outcomeEmoji: Record<GameResult['outcome'], string> = {
  win: '🏆',
  loss: '💣',
  stuck: '🤔',
  error: '❌',
  playing: '⏳',
};

export function RankingTable({ results }: RankingTableProps) {
  if (results.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      <h2 className="text-2xl font-bold text-center mb-4">Final Rankings</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moves</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((res, index) => (
              <tr key={res.modelId} className={index === 0 ? 'bg-green-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{res.modelId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="mr-2">{outcomeEmoji[res.outcome]}</span>
                  {res.outcome}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{res.score}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.moves}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(res.durationMs / 1000).toFixed(2)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
