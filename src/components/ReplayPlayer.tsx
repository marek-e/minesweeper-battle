'use client'

import { BoardGrid } from './BoardGrid'
import type { BoardState, GameResult } from '@/lib/types'

type ModelPanelProps = {
  modelId: string
  result: GameResult
  board: BoardState
  currentFrame: number
  totalFrames: number
}

function ModelPanel({ modelId, result, board, currentFrame, totalFrames }: ModelPanelProps) {
  const outcome = result.outcome
  const isWin = outcome === 'win'
  const isLoss = outcome === 'loss'

  // Calculate time taken in seconds
  const timeTaken = Math.round(result.durationMs / 1000)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-200">{modelId}</h2>
            {isWin && (
              <span className="rounded border border-green-500/50 bg-green-500/20 px-2 py-1 text-xs font-bold text-green-400 uppercase">
                WIN
              </span>
            )}
            {isLoss && (
              <span className="rounded border border-red-500/50 bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400 uppercase">
                LOSS
              </span>
            )}
            {!isWin && !isLoss && (
              <span className="rounded border border-yellow-500/50 bg-yellow-500/20 px-2 py-1 text-xs font-bold text-yellow-400 uppercase">
                {outcome.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 p-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="mb-1 text-xs text-slate-400">Total Moves</div>
          <div className="text-lg font-semibold text-slate-200">{result.moves}</div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="mb-1 text-xs text-slate-400">Time Taken</div>
          <div className="text-lg font-semibold text-slate-200">{timeTaken}s</div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
          <div className="mb-1 text-xs text-slate-400">Final Score</div>
          <div className="text-lg font-semibold text-slate-200">{result.score}</div>
        </div>
      </div>

      {/* Mini board preview (move history) */}
      <div className="px-4 pb-2">
        <div className="mb-2 text-xs text-slate-400">Move History</div>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {/* This would show a mini representation of moves - simplified for now */}
          <div className="text-xs text-slate-500">
            Frame {currentFrame + 1} of {totalFrames}
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 overflow-auto bg-slate-950/50 p-4">
        <div className="flex justify-center">
          <BoardGrid board={board} />
        </div>
      </div>
    </div>
  )
}

type ReplayPlayerProps = {
  models: string[]
  results: Record<string, GameResult>
  frames: Record<string, Array<{ boardState: BoardState }>>
  currentFrame: number
}

export function ReplayPlayer({ models, results, frames, currentFrame }: ReplayPlayerProps) {
  return (
    <div className="grid h-[calc(100vh-200px)] grid-cols-1 gap-6 lg:grid-cols-2">
      {models.map((modelId) => {
        const modelFrames = frames[modelId] || []
        const frameIndex = Math.min(currentFrame, modelFrames.length - 1)
        const currentBoard = modelFrames[frameIndex]?.boardState || modelFrames[0]?.boardState
        const result = results[modelId]

        if (!currentBoard || !result) return null

        return (
          <ModelPanel
            key={modelId}
            modelId={modelId}
            result={result}
            board={currentBoard}
            currentFrame={frameIndex}
            totalFrames={modelFrames.length}
          />
        )
      })}
    </div>
  )
}
