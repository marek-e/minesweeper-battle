import { AuthorizedModel } from './battleConfig'
import type { GameConfig, BoardState, GameOutcome, GameResult } from './types'

export type BattleStatus = 'pending' | 'running' | 'complete'

export type ModelState = {
  boardState: BoardState | null
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
      boardState: BoardState
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

class BattleStore {
  private battles = new Map<string, BattleState>()
  private readonly BATTLE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

  createBattle(config: GameConfig, models: AuthorizedModel[]): string {
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
      subscribers: new Set(),
    }

    this.battles.set(battleId, battle)

    setTimeout(() => {
      this.battles.delete(battleId)
    }, this.BATTLE_EXPIRY_MS)

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
        modelState.boardState = event.boardState
        modelState.status = 'playing'
        modelState.moves++
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
      }
    } else if (event.type === 'done') {
      battle.status = 'complete'
      battle.rankings = event.rankings
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
