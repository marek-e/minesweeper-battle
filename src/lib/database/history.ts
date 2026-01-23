import { AuthorizedModel } from '../battleConfig'
import { GameConfig, GameResult } from '../types'
import { BattleMetadata } from './battle'
import { getKv } from './db'

export async function listBattles(
  status: string | null = null,
  limit: number = 50,
  offset: number = 0
): Promise<
  Array<{
    id: string
    config: GameConfig
    models: AuthorizedModel[]
    status: string
    rankings: GameResult[] | null
    createdAt: number
    completedAt: number | null
  }>
> {
  const kvClient = getKv()
  if (status === 'complete') {
    const battleIds = (await kvClient.zrange('battles:completed', -limit - offset, -offset - 1, {
      rev: true,
    })) as string[]

    const battles = await Promise.all(
      battleIds.map(async (id) => {
        const metadata = await kvClient.get<BattleMetadata>(`battle:${id}`)
        return metadata
      })
    )

    return battles
      .filter((b): b is BattleMetadata => b !== null)
      .map((b) => ({
        id: b.id,
        config: b.config,
        models: b.models,
        status: b.status,
        rankings: b.rankings,
        createdAt: b.createdAt,
        completedAt: b.completedAt,
      }))
  } else {
    const allBattleIds = (await kvClient.zrange('battles:completed', 0, -1, {
      rev: true,
    })) as string[]
    const allBattles = await Promise.all(
      allBattleIds.map(async (id) => {
        const metadata = await kvClient.get<BattleMetadata>(`battle:${id}`)
        return metadata
      })
    )

    const filtered = allBattles
      .filter((b): b is BattleMetadata => b !== null && (!status || b.status === status))
      .slice(offset, offset + limit)

    return filtered.map((b) => ({
      id: b.id,
      config: b.config,
      models: b.models,
      status: b.status,
      rankings: b.rankings,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
    }))
  }
}

export async function countBattles(status: string | null = null): Promise<number> {
  const kvClient = getKv()
  if (status === 'complete') {
    return await kvClient.zcard('battles:completed')
  } else {
    const allBattleIds = (await kvClient.zrange('battles:completed', 0, -1)) as string[]
    const allBattles = await Promise.all(
      allBattleIds.map(async (id) => {
        const metadata = await kvClient.get<BattleMetadata>(`battle:${id}`)
        return metadata
      })
    )
    return allBattles.filter(
      (b): b is BattleMetadata => b !== null && (!status || b.status === status)
    ).length
  }
}
