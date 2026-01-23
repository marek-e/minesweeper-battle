'use client'

import { Button } from '@/components/ui/Button'
import { RankingTable } from '@/components/RankingTable'
import { BoardState } from '@/lib/types'
import { decodeBoard } from '@/lib/minesweeper'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { BoardGrid } from '@/components/BoardGrid'
import { cn } from '@/lib/utils'
import { PersistedModelState } from '@/lib/database/modelState'
import { executeModelMove, getBattleState } from '@/lib/api'
import { BattleMetadata } from '@/lib/database/battle'
import { BattleState } from '@/app/api/battles/[battleId]/state/route'

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

type ArenaContentProps = {
  battleId: string
  modelStates: Record<string, PersistedModelState>
  battleMetadata: BattleMetadata | null
}

export function ArenaContent({ battleId, modelStates, battleMetadata }: ArenaContentProps) {
  const [battleState, setBattleState] = useState<BattleState>({
    status: 'running',
    battleMetadata,
    modelStates,
    error: undefined,
  })

  const battleLoopRef = useRef<boolean>(false)
  const modelStatesRef = useRef<Record<string, PersistedModelState>>(modelStates)
  const modelLoopRefs = useRef<Record<string, boolean>>({})
  const activeModelsRef = useRef<string[]>(Object.keys(modelStates))

  useEffect(() => {
    // const loadBattleState = async () => {
    //   try {
    //     setBattleState((prev) => ({ ...prev, status: 'loading' }))

    //     const state = await getBattleState(battleId)
    //     console.debug('Loaded battle state:', state)

    //     // Update ref with initial model states
    //     modelStatesRef.current = state.modelStates

    //     setBattleState({
    //       status: 'running',
    //       battleMetadata: state.battleMetadata,
    //       modelStates: state.modelStates,
    //     })

    //     // Start battle loop if not all models are complete
    //     console.log('Model states from API:', state.modelStates)
    //     const allComplete = Object.values(state.modelStates).every(
    //       (modelState) => modelState.outcome !== 'playing'
    //     )
    //     console.log('All complete?', allComplete, 'battleLoopRef.current:', battleLoopRef.current)

    //     if (!allComplete && !battleLoopRef.current) {
    //       battleLoopRef.current = true
    //       console.log('Starting battle loop for models:', Object.keys(state.modelStates))
    //       startBattleLoop(battleId, Object.keys(state.modelStates))
    //     } else if (allComplete) {
    //       console.log('All models complete, showing rankings')
    //       setBattleState((prev) => ({
    //         ...prev,
    //         status: 'complete',
    //         rankings: state.battleMetadata?.rankings || null,
    //       }))
    //     } else {
    //       console.log('Not starting battle loop - already running or other condition')
    //     }
    //   } catch (error) {
    //     console.error('Error loading battle state:', error)
    //     setBattleState((prev) => ({
    //       ...prev,
    //       status: 'error',
    //       error: {
    //         message: error instanceof Error ? error.message : 'Failed to load battle',
    //         code: 'unknown',
    //       },
    //     }))
    //   }
    // }

    const startBattleLoop = (battleId: string, models: string[]) => {
      battleLoopRef.current = true
      activeModelsRef.current = models

      // Independent loop for each model - faster models update UI immediately
      const runModelLoop = async (modelId: string) => {
        modelLoopRefs.current[modelId] = true

        while (battleLoopRef.current && modelLoopRefs.current[modelId]) {
          const state = modelStatesRef.current[modelId]
          if (state?.outcome !== 'playing') {
            console.log(`Model ${modelId} is complete, stopping its loop`)
            break
          }

          try {
            console.log(`Fetching move for ${modelId}`)
            const result = await executeModelMove(battleId, modelId)

            if (!result.success) {
              console.error(`Failed to execute move for ${modelId}:`, result.error)
              // Wait a bit before retrying to avoid spamming
              await new Promise((resolve) => setTimeout(resolve, 1000))
              continue
            }

            console.log(`Move result for ${modelId}:`, result)

            // Update UI from API response for this model only
            setBattleState((prev) => {
              const modelState = prev.modelStates[modelId]
              if (!modelState || !prev.battleMetadata?.config) return prev

              const boardState = result.compactBoard
                ? visibleBoardToBoardState(
                    decodeBoard(
                      result.compactBoard,
                      prev.battleMetadata.config.rows,
                      prev.battleMetadata.config.cols
                    )
                  )
                : null

              const newModelState: PersistedModelState = {
                boardState,
                prevBoardState: prev.modelStates[modelId]?.boardState || null,
                outcome: result.outcome || 'playing',
                moves: result.moves,
                safeRevealed: result.safeRevealed,
                minesHit: result.minesHit,
                startTime: prev.modelStates[modelId]?.startTime || Date.now(),
              }

              const newModelStates = { ...prev.modelStates, [modelId]: newModelState }

              // Update ref for immediate access
              modelStatesRef.current = newModelStates

              // If all models complete, update rankings
              if (result.allModelsComplete && result.rankings) {
                // Stop all model loops
                Object.keys(modelLoopRefs.current).forEach((id) => {
                  modelLoopRefs.current[id] = false
                })
                battleLoopRef.current = false

                return {
                  ...prev,
                  modelStates: newModelStates,
                  status: 'complete',
                  battleMetadata: prev.battleMetadata
                    ? { ...prev.battleMetadata, rankings: result.rankings }
                    : null,
                }
              }

              return { ...prev, modelStates: newModelStates }
            })

            // If this model completed, stop its loop
            if (result.completed) {
              console.log(`Model ${modelId} completed`)
              modelLoopRefs.current[modelId] = false
              break
            }

            // Check if all models are complete
            const allComplete = models.every((id) => {
              const s = modelStatesRef.current[id]
              return s?.outcome !== 'playing'
            })

            if (allComplete) {
              console.log('All models complete, fetching final rankings')
              battleLoopRef.current = false
              Object.keys(modelLoopRefs.current).forEach((id) => {
                modelLoopRefs.current[id] = false
              })

              // Fetch final rankings
              const state = await getBattleState(battleId)
              setBattleState((prev) => ({
                ...prev,
                status: 'complete',
                battleMetadata: state.battleMetadata,
              }))
              break
            }

            // Continue immediately for this model (no waiting for other models)
          } catch (error) {
            console.error(`Error executing move for ${modelId}:`, error)
            // Wait a bit before retrying on error
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }
        }

        // Mark this model's loop as stopped
        modelLoopRefs.current[modelId] = false
      }

      // Start independent loops for all models concurrently
      models.forEach((modelId) => {
        runModelLoop(modelId).catch((error) => {
          console.error(`Model loop error for ${modelId}:`, error)
          modelLoopRefs.current[modelId] = false
        })
      })
    }

    // loadBattleState()
    startBattleLoop(battleId, Object.keys(modelStates))

    // Capture ref values for cleanup
    const cleanup = () => {
      battleLoopRef.current = false
      const modelsToStop = activeModelsRef.current
      const loopRefs = modelLoopRefs.current
      modelsToStop.forEach((modelId) => {
        loopRefs[modelId] = false
      })
    }

    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps -- modelStates is intentionally read once on mount
  }, [battleId])

  const modelStatuses = useMemo(() => {
    return Object.entries(battleState.modelStates).map(([modelId, state]) => ({
      modelId,
      status: state.outcome === 'playing' ? 'running' : 'completed',
    }))
  }, [battleState.modelStates])

  const allCompleted =
    battleState.status === 'complete' &&
    Object.values(battleState.modelStates).every((s) => s.outcome !== 'playing')

  const config = battleState.battleMetadata?.config
  const rankings = battleState.battleMetadata?.rankings

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
          <Button href="/history" variant="secondary" className="px-6 py-3">
            Battle History
          </Button>
        </div>

        {/* Loading Status */}
        {battleState.status === 'loading' && (
          <div className="mb-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
            <p className="mt-2 text-slate-400">Loading battle...</p>
          </div>
        )}

        {/* Error Status */}
        {battleState.status === 'error' && battleState.error && (
          <div className="mb-8 rounded-xl border border-red-500/50 bg-red-900/10 p-6 text-center">
            <div className="mb-2 text-xl font-semibold text-red-400">Battle Error</div>
            <p className="mb-4 text-slate-300">{battleState.error.message}</p>
            {battleState.error.code === 'credit_exhausted' && (
              <p className="text-sm text-slate-400">
                API credits exhausted. Please check your AI Gateway billing.
              </p>
            )}
            <div className="mt-6">
              <Button href="/setup" className="px-6 py-3">
                Start New Battle
              </Button>
            </div>
          </div>
        )}

        {/* Model Boards */}
        {modelStatuses.length > 0 && config && (
          <div className={cn('mb-8 grid gap-6', config.cols > 20 ? 'grid-cols-1' : 'grid-cols-2')}>
            {modelStatuses.map(({ modelId, status }) => {
              const modelState = battleState.modelStates[modelId]

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
        {allCompleted && rankings && rankings.length > 0 && (
          <>
            <RankingTable results={rankings} />
            {battleId && (
              <div className="mt-8 text-center">
                <Button href={`/replay/${battleId}`} className="px-8 py-3">
                  See Replay
                </Button>
              </div>
            )}
          </>
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
