'use client'

import Link from 'next/link'
import type { GameResult, GameConfig } from '@/lib/types'
import { Trophy, Skull, HelpCircle, AlertCircle, Grid3X3, Bomb, Play } from 'lucide-react'

type BattleCardProps = {
  battleId: string
  config: GameConfig
  models: string[]
  rankings: GameResult[] | null
  createdAt: number
  completedAt: number | null
}

const outcomeConfig = {
  win: {
    icon: Trophy,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Won',
  },
  loss: {
    icon: Skull,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    label: 'Lost',
  },
  stuck: {
    icon: HelpCircle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    label: 'Stuck',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
    label: 'Error',
  },
  playing: {
    icon: Play,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    label: 'Playing',
  },
} as const

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
    hour: 'numeric',
    minute: '2-digit',
  })

  const winner = rankings?.[0]
  const hasWinner = winner?.outcome === 'win'

  return (
    <Link href={`/replay/${battleId}`} className="group block">
      <div
        className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-200 ${
          hasWinner
            ? 'border-emerald-500/20 bg-linear-to-br from-slate-800 to-emerald-950/20 hover:border-emerald-500/40'
            : 'border-slate-700/50 bg-slate-800/80 hover:border-slate-600'
        } hover:shadow-lg hover:shadow-black/20`}
      >
        {/* Subtle glow for winners */}
        {hasWinner && (
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
        )}

        {/* Header */}
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-mono text-lg font-semibold tracking-tight text-slate-100">
              #{battleId.slice(-6)}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Grid3X3 size={14} className="text-slate-500" />
                {config.rows}×{config.cols}
              </span>
              <span className="flex items-center gap-1.5">
                <Bomb size={14} className="text-slate-500" />
                {config.mineCount}
              </span>
            </div>
          </div>
          <time className="shrink-0 text-xs text-slate-500">{dateStr}</time>
        </div>

        {/* Winner highlight */}
        {winner && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 ${
              hasWinner
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-700/30'
            }`}
          >
            <Trophy size={16} className={hasWinner ? 'text-emerald-400' : 'text-slate-500'} />
            <span
              className={`text-sm font-medium ${hasWinner ? 'text-emerald-300' : 'text-slate-400'}`}
            >
              {winner.modelId}
            </span>
            <span
              className={`ml-auto text-xs ${hasWinner ? 'text-emerald-400/70' : 'text-slate-500'}`}
            >
              {winner.score} pts
            </span>
          </div>
        )}

        {/* Model results */}
        <div className="flex flex-wrap gap-2">
          {models.map((modelId) => {
            const result = rankings?.find((r) => r.modelId === modelId)
            const outcome = result?.outcome || 'playing'
            const cfg = outcomeConfig[outcome]
            const Icon = cfg.icon

            return (
              <div
                key={modelId}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.border}`}
              >
                <Icon size={12} className={cfg.text} />
                <span className={cfg.text}>{modelId.split('-').slice(0, 2).join('-')}</span>
                {result && <span className="ml-1 text-slate-500">{result.score}</span>}
              </div>
            )
          })}
        </div>

        {/* Hover indicator */}
        <div className="mt-4 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <span className="text-xs text-slate-500">View replay →</span>
        </div>
      </div>
    </Link>
  )
}
