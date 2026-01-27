import { AuthorizedModel } from '../battleConfig'
import { BoardState, GameOutcome } from '../types'
import { getKv } from './db'

export type PersistedModelState = {
  boardState: BoardState | null
  prevBoardState: BoardState | null
  moves: number
  safeRevealed: number
  minesHit: 0 | 1
  outcome: GameOutcome
  startTime: number
  endTime?: number
}

export async function getModelState(
  battleId: string,
  modelId: AuthorizedModel
): Promise<PersistedModelState | null> {
  const kvClient = getKv()
  const key = `battle:${battleId}:state:${modelId}`
  return await kvClient.get<PersistedModelState>(key)
}

export async function updateModelState(
  battleId: string,
  modelId: AuthorizedModel,
  state: PersistedModelState
): Promise<void> {
  const kvClient = getKv()
  const key = `battle:${battleId}:state:${modelId}`
  await kvClient.set(key, state)
}

export async function initializeModelState(
  battleId: string,
  modelId: AuthorizedModel
): Promise<void> {
  const existing = await getModelState(battleId, modelId)
  if (existing) return // Already initialized

  const initialState: PersistedModelState = {
    boardState: null,
    prevBoardState: null,
    moves: 0,
    safeRevealed: 0,
    minesHit: 0,
    outcome: 'playing',
    startTime: Date.now(),
  }
  await updateModelState(battleId, modelId, initialState)
  console.info('Initialized model state:', initialState)
}
