import { AuthorizedModel } from './battleConfig'
import type {
  GameConfig,
  BoardState,
  GameOutcome,
  GameResult,
  CompactBoard,
  CellDelta,
} from './types'
import { insertBattle, updateBattleCompletion, insertFrame, insertResult } from './db'
import { calculateScore } from './scoring'

export type BattleStatus = 'pending' | 'running' | 'complete'

export type ModelState = {
  boardState: BoardState | null
  prevBoardState: BoardState | null
  status: 'pending' | 'playing' | 'complete'
  outcome?: GameOutcome
  moves: number
  safeRevealed: number
  minesHit: 0 | 1
  durationMs: number
}

export type BattleState = {
  battleId: string
  status: BattleStatus
  config: GameConfig
  models: AuthorizedModel[]
  modelStates: Map<AuthorizedModel, ModelState>
  rankings: GameResult[] | null
  createdAt: number
  boardSeed?: number
  frameIndices: Map<AuthorizedModel, number>
  subscribers: Set<(event: BattleEvent) => void>
}

export type BattleEvent =
  | { type: 'init'; config: GameConfig; models: AuthorizedModel[] }
  | {
      type: 'move'
      modelId: AuthorizedModel
      action: 'reveal' | 'flag'
      row: number
      col: number
      board: CompactBoard // Compact string encoding
      delta?: CellDelta[] // Changed cells only (optional for efficiency)
      boardState: BoardState // Full state for internal use
    }
  | {
      type: 'complete'
      modelId: AuthorizedModel
      outcome: GameOutcome
      moves: number
      safeRevealed: number
      minesHit: 0 | 1
      durationMs: number
    }
  | { type: 'done'; rankings: GameResult[] }
  | { type: 'error'; error: string; code: 'credit_exhausted' | 'unknown' }

class BattleStore {
  private battles = new Map<string, BattleState>()

  createBattle(config: GameConfig, models: AuthorizedModel[], boardSeed: number): string {
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const battle: BattleState = {
      battleId,
      status: 'pending',
      config,
      models,
      modelStates: new Map(
        models.map((modelId) => [
          modelId,
          {
            boardState: null,
            prevBoardState: null,
            status: 'pending',
            moves: 0,
            safeRevealed: 0,
            minesHit: 0,
            durationMs: 0,
          },
        ])
      ),
      rankings: null,
      createdAt: Date.now(),
      boardSeed,
      frameIndices: new Map(models.map((modelId) => [modelId, 0])),
      subscribers: new Set(),
    }

    this.battles.set(battleId, battle)

    insertBattle(battleId, config, models, boardSeed).catch((err) => {
      console.error(`[BattleStore] Error inserting battle ${battleId}:`, err)
    })

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

    for (const modelId of models) {
      insertFrame(battleId, modelId, 0, null, null, null, emptyBoard).catch((err) => {
        console.error(`[BattleStore] Error inserting initial frame for ${modelId}:`, err)
      })
    }

    return battleId
  }

  getBattle(battleId: string): BattleState | undefined {
    return this.battles.get(battleId)
  }

  subscribe(battleId: string, callback: (event: BattleEvent) => void): () => void {
    const battle = this.battles.get(battleId)
    if (!battle) {
      throw new Error(`Battle ${battleId} not found`)
    }

    battle.subscribers.add(callback)

    return () => {
      battle.subscribers.delete(callback)
    }
  }

  emit(battleId: string, event: BattleEvent): void {
    const battle = this.battles.get(battleId)
    if (!battle) {
      return
    }

    if (event.type === 'init') {
      battle.status = 'running'
    } else if (event.type === 'move') {
      const modelState = battle.modelStates.get(event.modelId)
      if (modelState) {
        modelState.prevBoardState = modelState.boardState
        modelState.boardState = event.boardState
        modelState.status = 'playing'
        modelState.moves++

        const frameIndex = battle.frameIndices.get(event.modelId) ?? 0
        insertFrame(
          battleId,
          event.modelId,
          frameIndex,
          event.action,
          event.row,
          event.col,
          event.boardState
        ).catch((err) => {
          console.error(`[BattleStore] Error inserting frame for ${event.modelId}:`, err)
        })
        battle.frameIndices.set(event.modelId, frameIndex + 1)
      }
    } else if (event.type === 'complete') {
      const modelState = battle.modelStates.get(event.modelId)
      if (modelState) {
        modelState.status = 'complete'
        modelState.outcome = event.outcome
        modelState.moves = event.moves
        modelState.safeRevealed = event.safeRevealed
        modelState.minesHit = event.minesHit
        modelState.durationMs = event.durationMs

        const score = calculateScore({
          outcome: event.outcome,
          safeRevealed: event.safeRevealed,
          moves: event.moves,
          minesHit: event.minesHit,
          config: battle.config,
        })

        insertResult(battleId, event.modelId, {
          modelId: event.modelId,
          outcome: event.outcome,
          score,
          moves: event.moves,
          durationMs: event.durationMs,
          safeRevealed: event.safeRevealed,
          totalSafe: battle.config.rows * battle.config.cols - battle.config.mineCount,
          minesHit: event.minesHit,
        }).catch((err) => {
          console.error(`[BattleStore] Error inserting result for ${event.modelId}:`, err)
        })
      }
    } else if (event.type === 'done') {
      battle.status = 'complete'
      battle.rankings = event.rankings

      updateBattleCompletion(battleId, 'complete', event.rankings).catch((err) => {
        console.error(`[BattleStore] Error updating battle completion:`, err)
      })
    } else if (event.type === 'error') {
      // Error events are broadcast to subscribers but don't change battle state
      // The battle will continue with error outcomes for affected models
    }

    battle.subscribers.forEach((callback) => {
      callback(event)
    })
  }

  updateModelState(battleId: string, modelId: AuthorizedModel, updates: Partial<ModelState>): void {
    const battle = this.battles.get(battleId)
    if (!battle) return

    const modelState = battle.modelStates.get(modelId)
    if (modelState) {
      Object.assign(modelState, updates)
    }
  }
}

export const battleStore = new BattleStore()
