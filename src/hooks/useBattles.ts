import { useQuery } from '@tanstack/react-query'
import type { GameResult, GameConfig } from '@/lib/types'

type Battle = {
  id: string
  config: GameConfig
  models: string[]
  status: string
  rankings: GameResult[] | null
  createdAt: number
  completedAt: number | null
}

type BattlesResponse = {
  battles: Battle[]
  total: number
  limit: number
  offset: number
}

async function fetchBattles(
  status: string | null,
  limit: number,
  offset: number
): Promise<BattlesResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (status) {
    params.set('status', status)
  }

  const res = await fetch(`/api/battles?${params.toString()}`)
  if (!res.ok) {
    throw new Error('Failed to fetch battles')
  }
  return res.json()
}

export function useBattles(status: string | null = null, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['battles', status, limit, offset],
    queryFn: () => fetchBattles(status, limit, offset),
  })
}
