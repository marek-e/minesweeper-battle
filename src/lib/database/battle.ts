import { AuthorizedModel } from '../battleConfig'
import { GameConfig, GameResult } from '../types'
import { getKv } from './db'

export type BattleStatus = 'pending' | 'running' | 'complete'

export type BattleMetadata = {
  id: string
  config: GameConfig
  models: AuthorizedModel[]
  status: BattleStatus
  rankings: GameResult[] | null
  boardSeed: number
  minePositions: [number, number][]
  createdAt: number
  completedAt: number | null
}

export async function insertBattle(
  id: string,
  config: GameConfig,
  models: AuthorizedModel[],
  boardSeed: number,
  minePositions: [number, number][]
): Promise<void> {
  const kvClient = getKv()
  const metadata: BattleMetadata = {
    id,
    config,
    models,
    status: 'pending',
    rankings: null,
    boardSeed,
    minePositions,
    createdAt: Date.now(),
    completedAt: null,
  }

  await kvClient.set(`battle:${id}`, metadata)
  console.info('Created battle:', metadata)
}

export async function getBattleMetadata(battleId: string): Promise<BattleMetadata | null> {
  const kvClient = getKv()
  return await kvClient.get<BattleMetadata>(`battle:${battleId}`)
}

export async function updateBattleCompletion(
  id: string,
  status: BattleStatus,
  rankings: GameResult[] | null
): Promise<void> {
  const kvClient = getKv()
  const metadata = (await kvClient.get<BattleMetadata>(`battle:${id}`))!
  metadata.status = status
  metadata.rankings = rankings
  metadata.completedAt = Date.now()

  await kvClient.set(`battle:${id}`, metadata)

  if (status === 'complete') {
    await kvClient.zadd('battles:completed', {
      score: Date.now(),
      member: id,
    })
  }
}
