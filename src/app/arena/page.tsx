'use client'

import { useQueryState } from 'nuqs'
import { Button } from '@/components/ui/Button'
import { ReplayContainer } from '@/components/ReplayContainer'
import { RankingTable } from '@/components/RankingTable'
import {
  GameResult,
  ReplayFrame,
  GameOutcome,
  GameConfig,
  BoardState,
  CompactBoard,
} from '@/lib/types'
import { decodeBoard } from '@/lib/minesweeper'
import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { BoardGrid } from '@/components/BoardGrid'
import { parseAsString } from 'nuqs'

type ModelState = {
  boardState: BoardState | null
  compactBoard: CompactBoard | null // Compact encoded board
  status: 'pending' | 'playing' | 'complete'
  outcome?: GameOutcome
  moves: number
  safeRevealed: number
  minesHit: 0 | 1
  durationMs: number
  replayLog: ReplayFrame[]
}

// Convert decoded visible board to BoardState format for rendering
function visibleBoardToBoardState(visible: (string | number)[][]): BoardState {
  return visible.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      const isMine = cell === 'M'
      const isRevealed = typeof cell === 'number' || cell === 'M' || (cell !== 'H' && cell !== 'F')
      const isFlagged = cell === 'F'
      const adjacentMines = typeof cell === 'number' ? cell : 0

      return {
        row: rowIdx,
        col: colIdx,
        isMine,
        isRevealed,
        isFlagged,
        adjacentMines,
      }
    })
  )
}

type BattleState = {
  status: 'idle' | 'connecting' | 'running' | 'complete'
  config: GameConfig | null
  models: string[]
  modelStates: Map<string, ModelState>
  rankings: GameResult[] | null
}

function ArenaContent() {
  const [battleId] = useQueryState('battleId', parseAsString)
  const [battleState, setBattleState] = useState<BattleState>({
    status: 'idle',
    config: null,
    models: [],
    modelStates: new Map(),
    rankings: null,
  })

  const eventSourceRef = useRef<EventSource | null>(null)

  const initializeModels = (models: string[], config: GameConfig) => {
    const modelStates = new Map<string, ModelState>()
    models.forEach((modelId) => {
      const emptyBoard: BoardState = Array.from({ length: config.rows }, (_, row) =>
        Array.from({ length: config.cols }, (_, col) => ({
          row,
          col,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          adjacentMines: 0,
        }))
      )

      modelStates.set(modelId, {
        boardState: null,
        compactBoard: null,
        status: 'pending',
        moves: 0,
        safeRevealed: 0,
        minesHit: 0,
        durationMs: 0,
        replayLog: [
          {
            boardState: emptyBoard,
            move: null,
          },
        ],
      })
    })
    return modelStates
  }

  useEffect(() => {
    if (!battleId) return

    const eventSource = new EventSource(`/api/battle/${battleId}/stream`)
    eventSourceRef.current = eventSource

    queueMicrotask(() => {
      setBattleState((prev) => ({ ...prev, status: 'connecting' }))
    })

    eventSource.onopen = () => {
      setBattleState((prev) => ({ ...prev, status: 'running' }))
    }

    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data)
      const { config, models } = data

      setBattleState({
        status: 'running',
        config,
        models,
        modelStates: initializeModels(models, config),
        rankings: null,
      })
    })

    eventSource.addEventListener('move', (e) => {
      const data = JSON.parse(e.data)
      const { modelId, action, row, col, board: compactBoard } = data

      setBattleState((prev) => {
        const modelState = prev.modelStates.get(modelId)
        if (!modelState || !prev.config) return prev

        // Decode compact board
        const visible = decodeBoard(compactBoard, prev.config.rows, prev.config.cols)
        const boardState = visibleBoardToBoardState(visible)

        const newModelState = {
          ...modelState,
          boardState,
          compactBoard,
          status: 'playing' as const,
          moves: modelState.moves + 1,
          replayLog: [
            ...modelState.replayLog,
            {
              boardState: JSON.parse(JSON.stringify(boardState)),
              move: { action, row, col },
            },
          ],
        }

        const newModelStates = new Map(prev.modelStates)
        newModelStates.set(modelId, newModelState)

        return { ...prev, modelStates: newModelStates }
      })
    })

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      const { modelId, outcome, moves, safeRevealed, minesHit, durationMs } = data

      setBattleState((prev) => {
        const modelState = prev.modelStates.get(modelId)
        if (!modelState) return prev

        const newModelStates = new Map(prev.modelStates)
        newModelStates.set(modelId, {
          ...modelState,
          status: 'complete',
          outcome,
          moves,
          safeRevealed,
          minesHit,
          durationMs,
        })

        return { ...prev, modelStates: newModelStates }
      })
    })

    eventSource.addEventListener('done', (e) => {
      const data = JSON.parse(e.data)
      const { rankings } = data

      setBattleState((prev) => ({
        ...prev,
        status: 'complete',
        rankings,
      }))

      eventSource.close()
    })

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      eventSource.close()
      setBattleState((prev) => ({ ...prev, status: 'idle' }))
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [battleId])

  const simulations = useMemo(() => {
    const sims: Array<{
      result: {
        modelId: string
        outcome: GameOutcome
        moves: number
        durationMs: number
        safeRevealed: number
        minesHit: 0 | 1
      }
      replayLog: ReplayFrame[]
    }> = []

    battleState.modelStates.forEach((modelState, modelId) => {
      if (modelState.outcome) {
        sims.push({
          result: {
            modelId,
            outcome: modelState.outcome,
            moves: modelState.moves,
            durationMs: modelState.durationMs,
            safeRevealed: modelState.safeRevealed,
            minesHit: modelState.minesHit,
          },
          replayLog: modelState.replayLog,
        })
      }
    })

    return sims
  }, [battleState.modelStates])

  const modelStatuses = useMemo(() => {
    return Array.from(battleState.modelStates.entries()).map(([modelId, state]) => ({
      modelId,
      status:
        state.status === 'complete'
          ? ('completed' as const)
          : state.status === 'playing'
            ? ('running' as const)
            : ('pending' as const),
    }))
  }, [battleState.modelStates])

  const allCompleted =
    battleState.status === 'complete' &&
    Array.from(battleState.modelStates.values()).every((s) => s.status === 'complete')

  const { config } = battleState

  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Minesweeper Battle</h1>
          <p className="mt-2 text-lg text-slate-400">LLM agents compete to solve Minesweeper.</p>
          {config && (
            <p className="mt-1 text-sm text-slate-500">
              Board: {config.rows}×{config.cols} with {config.mineCount} mines
            </p>
          )}
        </header>

        <div className="mb-8 flex flex-wrap justify-center gap-4">
          <Button href="/human" variant="secondary" className="px-6 py-3">
            Play as Human
          </Button>
          <Button href="/setup" variant="secondary" className="px-6 py-3">
            New Setup
          </Button>
        </div>

        {/* Connection Status */}
        {battleState.status === 'connecting' && (
          <div className="mb-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
            <p className="mt-2 text-slate-400">Connecting to battle...</p>
          </div>
        )}

        {/* Model Boards */}
        {modelStatuses.length > 0 && config && (
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {modelStatuses.map(({ modelId, status }) => {
              const modelState = battleState.modelStates.get(modelId)

              // Create empty board if no board state yet
              const emptyBoard: BoardState = Array.from({ length: config.rows }, (_, row) =>
                Array.from({ length: config.cols }, (_, col) => ({
                  row,
                  col,
                  isMine: false,
                  isRevealed: false,
                  isFlagged: false,
                  adjacentMines: 0,
                }))
              )
              const displayBoard = modelState?.boardState ?? emptyBoard

              return (
                <div
                  key={modelId}
                  className={`rounded-xl border p-4 transition-all ${
                    status === 'completed'
                      ? 'border-green-500/50 bg-green-900/10'
                      : status === 'running'
                        ? 'border-blue-500/50 bg-blue-900/10'
                        : 'border-slate-700 bg-slate-800/30'
                  }`}
                >
                  {/* Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status === 'running' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      )}
                      {status === 'completed' && <span className="text-green-400">✓</span>}
                      {status === 'pending' && (
                        <span className="h-4 w-4 rounded-full border-2 border-slate-600" />
                      )}
                      <span className="text-lg font-semibold text-slate-200">{modelId}</span>
                    </div>
                    <div className="text-sm text-slate-400">
                      {status === 'running' && `${modelState?.moves || 0} moves`}
                      {status === 'completed' && modelState?.outcome && (
                        <span
                          className={
                            modelState.outcome === 'win' ? 'text-green-400' : 'text-red-400'
                          }
                        >
                          {modelState.outcome} · {modelState.moves} moves
                        </span>
                      )}
                      {status === 'pending' && 'Waiting...'}
                    </div>
                  </div>

                  {/* Board */}
                  <div className="flex justify-center rounded-lg bg-slate-950/50 p-2">
                    <BoardGrid board={displayBoard} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Rankings */}
        {allCompleted && battleState.rankings && battleState.rankings.length > 0 && (
          <RankingTable results={battleState.rankings} />
        )}

        {/* Replay */}
        {simulations.length > 0 && (
          <div className="mt-12">
            <ReplayContainer simulations={simulations} />
          </div>
        )}

        {/* Empty state */}
        {!battleId && battleState.status === 'idle' && (
          <div className="mt-12 rounded-xl border border-slate-700/50 bg-slate-800/30 p-12 text-center">
            <p className="text-lg text-slate-400">
              No battle in progress. Start a new battle from the setup page.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

export default function ArenaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </main>
      }
    >
      <ArenaContent />
    </Suspense>
  )
}
