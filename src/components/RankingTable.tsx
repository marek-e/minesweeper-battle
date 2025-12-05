'use client'

import type { GameResult } from '@/lib/types'

type RankingTableProps = {
  results: GameResult[]
}

const outcomeEmoji: Record<GameResult['outcome'], string> = {
  win: '🏆',
  loss: '💣',
  stuck: '🤔',
  error: '❌',
  playing: '⏳',
}

export function RankingTable({ results }: RankingTableProps) {
  if (results.length === 0) return null

  return (
    <div className="mx-auto mt-12 w-full max-w-4xl">
      <h2 className="mb-4 text-center text-2xl font-bold">Final Rankings</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Outcome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Moves
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((res, index) => (
              <tr key={res.modelId} className={index === 0 ? 'bg-green-50' : ''}>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {index + 1}
                </td>
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-800">
                  {res.modelId}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  <span className="mr-2">{outcomeEmoji[res.outcome]}</span>
                  {res.outcome}
                </td>
                <td className="px-6 py-4 text-sm font-bold whitespace-nowrap text-gray-900">
                  {res.score}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{res.moves}</td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {(res.durationMs / 1000).toFixed(2)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
