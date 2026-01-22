'use client'

import { useQueryState } from 'nuqs'
import { Button } from '@/components/ui/Button'
import { RankingTable } from '@/components/RankingTable'
import { GameResult, GameOutcome, GameConfig, BoardState, CompactBoard } from '@/lib/types'
import { decodeBoard } from '@/lib/minesweeper'
import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { BoardGrid } from '@/components/BoardGrid'
import { parseAsString } from 'nuqs'
import { cn } from '@/lib/utils'

type ModelState = {
  boardState: BoardState | null
  compactBoard: CompactBoard | null
  status: 'pending' | 'playing' | 'complete'
  outcome?: GameOutcome
  moves: number
  safeRevealed: number
  minesHit: 0 | 1
  durationMs: number
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
  status: 'idle' | 'loading' | 'running' | 'complete' | 'error'
  config: GameConfig | null
  models: string[]
  modelStates: Map<string, ModelState>
  rankings: GameResult[] | null
  error?: { message: string; code: 'credit_exhausted' | 'unknown' }
}

function ArenaContent() {
  const [battleId] = useQueryState('battleId', parseAsString)
  const [battleState, setBattleState] = useState<BattleState>({
    status: 'idle',
    config: null,
    models: [],
    modelStates: new Map(),
    rankings: null,
    error: undefined,
  })

  const battleLoopRef = useRef<boolean>(false)
  const modelStatesRef = useRef<Map<string, ModelState>>(new Map())
  const modelLoopRefs = useRef<Map<string, boolean>>(new Map())
  const activeModelsRef = useRef<string[]>([])

  useEffect(() => {
    if (!battleId) {
      console.log('No battleId, returning early')
      return
    }

    console.log('Loading battle:', battleId)

    const loadBattleState = async () => {
      try {
        setBattleState((prev) => ({ ...prev, status: 'loading' }))
        
        const response = await fetch(`/api/battle/${battleId}/state`)
        if (!response.ok) {
          throw new Error('Failed to load battle state')
        }

        const data = await response.json()
        console.log('Loaded battle state:', data)

        const modelStates = new Map<string, ModelState>()
        for (const modelId of data.models) {
          const state = data.modelStates[modelId]
          const boardState = state.compactBoard
            ? visibleBoardToBoardState(decodeBoard(state.compactBoard, data.config.rows, data.config.cols))
            : null

          modelStates.set(modelId, {
            boardState,
            compactBoard: state.compactBoard || null,
            status: state.status,
            outcome: state.outcome,
            moves: state.moves,
            safeRevealed: state.safeRevealed,
            minesHit: state.minesHit,
            durationMs: 0,
          })
        }

        // Update ref with initial model states
        modelStatesRef.current = modelStates
        
        setBattleState({
          status: 'running',
          config: data.config,
          models: data.models,
          modelStates,
          rankings: data.rankings,
        })

        // Start battle loop if not all models are complete
        console.log('Model states from API:', data.modelStates)
        const allComplete = data.models.every((modelId: string) => 
          data.modelStates[modelId].status === 'complete'
        )
        console.log('All complete?', allComplete, 'battleLoopRef.current:', battleLoopRef.current)

        if (!allComplete && !battleLoopRef.current) {
          battleLoopRef.current = true
          console.log('Starting battle loop for models:', data.models)
          startBattleLoop(battleId, data.models)
        } else if (allComplete) {
          console.log('All models complete, showing rankings')
          setBattleState((prev) => ({
            ...prev,
            status: 'complete',
            rankings: data.rankings,
          }))
        } else {
          console.log('Not starting battle loop - already running or other condition')
        }
      } catch (error) {
        console.error('Error loading battle state:', error)
        setBattleState((prev) => ({
          ...prev,
          status: 'error',
          error: {
            message: error instanceof Error ? error.message : 'Failed to load battle',
            code: 'unknown',
          },
        }))
      }
    }

    const startBattleLoop = (battleId: string, models: string[]) => {
      // Store active models for cleanup
      activeModelsRef.current = models
      
      // Independent loop for each model - faster models update UI immediately
      const runModelLoop = async (modelId: string) => {
        // Mark this model's loop as running
        modelLoopRefs.current.set(modelId, true)
        
        while (battleLoopRef.current && modelLoopRefs.current.get(modelId)) {
          // Check if this model is complete
          const state = modelStatesRef.current.get(modelId)
          if (state?.status === 'complete') {
            console.log(`Model ${modelId} is complete, stopping its loop`)
            break
          }

          try {
            console.log(`Fetching move for ${modelId}`)
            const response = await fetch(`/api/battle/${battleId}/move?model=${modelId}`)
            
            if (!response.ok) {
              console.error(`Failed to execute move for ${modelId}:`, await response.text())
              // Wait a bit before retrying to avoid spamming
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
            
            const result = await response.json()
            console.log(`Move result for ${modelId}:`, result)

            // Update UI from API response for this model only
            setBattleState((prev) => {
              const modelState = prev.modelStates.get(modelId)
              if (!modelState || !prev.config) return prev

              const boardState = result.compactBoard
                ? visibleBoardToBoardState(decodeBoard(result.compactBoard, prev.config.rows, prev.config.cols))
                : null

              const newModelState: ModelState = {
                boardState,
                compactBoard: result.compactBoard || null,
                status: result.completed ? 'complete' : 'playing',
                outcome: result.outcome,
                moves: result.moves,
                safeRevealed: result.safeRevealed,
                minesHit: result.minesHit,
                durationMs: result.durationMs,
              }

              const newModelStates = new Map(prev.modelStates)
              newModelStates.set(modelId, newModelState)
              
              // Update ref for immediate access
              modelStatesRef.current = newModelStates

              // If all models complete, update rankings
              if (result.allModelsComplete && result.rankings) {
                // Stop all model loops
                modelLoopRefs.current.forEach((_, id) => {
                  modelLoopRefs.current.set(id, false)
                })
                battleLoopRef.current = false
                
                return {
                  ...prev,
                  modelStates: newModelStates,
                  status: 'complete',
                  rankings: result.rankings,
                }
              }

              return { ...prev, modelStates: newModelStates }
            })

            // If this model completed, stop its loop
            if (result.completed) {
              console.log(`Model ${modelId} completed`)
              modelLoopRefs.current.set(modelId, false)
              break
            }

            // Check if all models are complete
            const allComplete = models.every((id) => {
              const s = modelStatesRef.current.get(id)
              return s?.status === 'complete'
            })

            if (allComplete) {
              console.log('All models complete, fetching final rankings')
              battleLoopRef.current = false
              modelLoopRefs.current.forEach((_, id) => {
                modelLoopRefs.current.set(id, false)
              })
              
              // Fetch final rankings
              try {
                const response = await fetch(`/api/battle/${battleId}/state`)
                if (response.ok) {
                  const data = await response.json()
                  setBattleState((prev) => ({
                    ...prev,
                    status: 'complete',
                    rankings: data.rankings,
                  }))
                }
              } catch (error) {
                console.error('Error fetching final rankings:', error)
              }
              break
            }

            // Continue immediately for this model (no waiting for other models)
          } catch (error) {
            console.error(`Error executing move for ${modelId}:`, error)
            // Wait a bit before retrying on error
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        
        // Mark this model's loop as stopped
        modelLoopRefs.current.set(modelId, false)
      }

      // Start independent loops for all models concurrently
      models.forEach((modelId) => {
        runModelLoop(modelId).catch((error) => {
          console.error(`Model loop error for ${modelId}:`, error)
          modelLoopRefs.current.set(modelId, false)
        })
      })
    }

    loadBattleState()

    return () => {
      // Stop all battle loops
      battleLoopRef.current = false
      // Stop all individual model loops
      const modelsToStop = activeModelsRef.current
      const loopRefs = modelLoopRefs.current
      modelsToStop.forEach((modelId) => {
        loopRefs.set(modelId, false)
      })
    }
  }, [battleId])

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
          <>
            <RankingTable results={battleState.rankings} />
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
