'use client'

import Link from 'next/link'
import type { GameResult, GameConfig } from '@/lib/types'
import { Button } from './ui/Button'

type BattleCardProps = {
  battleId: string
  config: GameConfig
  models: string[]
  rankings: GameResult[] | null
  createdAt: number
  completedAt: number | null
}

export function BattleCard({
  battleId,
  config,
  models,
  rankings,
  createdAt,
  completedAt,
}: BattleCardProps) {
  const date = new Date(completedAt || createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const winner = rankings?.[0]

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-600">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-semibold text-slate-200">Battle {battleId.slice(-8)}</h3>
            {winner && (
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  winner.outcome === 'win'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {winner.modelId} won
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400">
            {config.rows}×{config.cols} board, {config.mineCount} mines
          </div>
        </div>
        <div className="text-xs text-slate-500">{dateStr}</div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        {models.map((modelId) => {
          const result = rankings?.find((r) => r.modelId === modelId)
          const outcome = result?.outcome || 'playing'
          return (
            <div
              key={modelId}
              className={`rounded px-2 py-1 text-xs ${
                outcome === 'win'
                  ? 'bg-green-500/20 text-green-400'
                  : outcome === 'loss'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-slate-700 text-slate-400'
              }`}
            >
              {modelId}: {outcome}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Link href={`/replay/${battleId}`}>
          <Button variant="secondary" className="px-3 py-1.5 text-sm">
            View Replay
          </Button>
        </Link>
      </div>
    </div>
  )
}
