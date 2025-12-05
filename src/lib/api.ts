import type { GameConfig } from './types'

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
