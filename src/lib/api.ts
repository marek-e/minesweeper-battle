import { BattleState } from '@/app/api/battles/[battleId]/state/route'
import type { GameConfig } from './types'
import { MoveResult } from './battleRunner'

export async function createBattle(
  config: GameConfig,
  models: string[]
): Promise<{ battleId: string }> {
  const response = await fetch('/api/battle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rows: config.rows,
      cols: config.cols,
      mineCount: config.mineCount,
      models,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to start battle')
  }

  return response.json()
}

export async function getBattleState(battleId: string): Promise<BattleState> {
  const response = await fetch(`/api/battles/${battleId}/state`)
  if (!response.ok) {
    throw new Error('Failed to get battle state')
  }
  return response.json()
}

export async function executeModelMove(battleId: string, modelId: string): Promise<MoveResult> {
  const response = await fetch(`/api/battles/${battleId}/move?model=${modelId}`)
  if (!response.ok) {
    throw new Error('Failed to make move')
  }
  return response.json()
}
