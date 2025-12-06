import { useQuery } from '@tanstack/react-query'
import type { BoardState, GameResult } from '@/lib/types'

type BattleData = {
  id: string
  config: { rows: number; cols: number; mineCount: number }
  models: string[]
  status: string
  rankings: GameResult[] | null
  frames: Record<string, Array<{ boardState: BoardState }>>
  results: Record<string, GameResult>
  boardSeed: number
  createdAt: number
  completedAt: number | null
}

async function fetchBattle(battleId: string): Promise<BattleData> {
  const res = await fetch(`/api/battles/${battleId}`)
  if (!res.ok) {
    throw new Error('Battle not found')
  }
  return res.json()
}

export function useBattle(battleId: string | null) {
  return useQuery({
    queryKey: ['battle', battleId],
    queryFn: () => fetchBattle(battleId!),
    enabled: !!battleId,
  })
}
