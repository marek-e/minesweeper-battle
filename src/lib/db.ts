import { kv } from '@vercel/kv'
import { GameConfig, GameResult, BoardState } from './types'
import { AuthorizedModel } from './battleConfig'

const inMemoryStore = new Map<string, unknown>()
const inMemorySortedSet = new Map<string, Array<{ score: number; member: string }>>()

if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Using in-memory storage (KV not configured). Data will be lost on restart.')
}

function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return kv
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      return (inMemoryStore.get(key) as T) || null
    },
    async set(key: string, value: unknown): Promise<void> {
      inMemoryStore.set(key, value)
    },
    async zadd(key: string, ...items: Array<{ score: number; member: string }>): Promise<number> {
      if (!inMemorySortedSet.has(key)) {
        inMemorySortedSet.set(key, [])
      }
      const set = inMemorySortedSet.get(key)!
      for (const item of items) {
        const existing = set.findIndex((x) => x.member === item.member)
        if (existing >= 0) {
          set[existing] = item
        } else {
          set.push(item)
        }
      }
      set.sort((a, b) => b.score - a.score) // Descending order
      return items.length
    },
    async zrange(
      key: string,
      start: number,
      end: number,
      options?: { rev?: boolean }
    ): Promise<string[]> {
      const set = inMemorySortedSet.get(key) || []
      const len = set.length
      const actualStart = start < 0 ? Math.max(0, len + start) : start
      const actualEnd = end < 0 ? len + end : end
      const slice = set.slice(actualStart, actualEnd + 1)
      const result = options?.rev ? slice : [...slice].reverse()
      return result.map((item) => item.member)
    },
    async zcard(key: string): Promise<number> {
      return inMemorySortedSet.get(key)?.length || 0
    },
  } as typeof kv
}

export type BattleFrame = {
  frameIndex: number
  action: 'reveal' | 'flag' | null
  row: number | null
  col: number | null
  boardState: BoardState
}

export type CompletedBattle = {
  id: string
  config: GameConfig
  models: AuthorizedModel[]
  status: string
  rankings: GameResult[] | null
  boardSeed: number
  createdAt: number
  completedAt: number | null
  frames: Map<AuthorizedModel, BattleFrame[]>
  results: Map<AuthorizedModel, GameResult>
}

type BattleMetadata = {
  id: string
  config: GameConfig
  models: AuthorizedModel[]
  status: string
  rankings: GameResult[] | null
  boardSeed: number
  createdAt: number
  completedAt: number | null
}

export async function insertBattle(
  id: string,
  config: GameConfig,
  models: AuthorizedModel[],
  boardSeed: number
): Promise<void> {
  const kvClient = getKv()
  const metadata: BattleMetadata = {
    id,
    config,
    models,
    status: 'pending',
    rankings: null,
    boardSeed,
    createdAt: Date.now(),
    completedAt: null,
  }

  await kvClient.set(`battle:${id}`, metadata)
}

export async function updateBattleCompletion(
  id: string,
  status: string,
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

export async function insertFrame(
  battleId: string,
  modelId: AuthorizedModel,
  frameIndex: number,
  action: 'reveal' | 'flag' | null,
  row: number | null,
  col: number | null,
  boardState: BoardState
): Promise<void> {
  const kvClient = getKv()
  const frame: BattleFrame = {
    frameIndex,
    action,
    row,
    col,
    boardState,
  }

  const key = `battle:${battleId}:frames:${modelId}`
  const frames = (await kvClient.get<BattleFrame[]>(key)) || []
  frames.push(frame)
  await kvClient.set(key, frames)
}

export async function insertResult(
  battleId: string,
  modelId: AuthorizedModel,
  result: GameResult
): Promise<void> {
  const kvClient = getKv()
  const key = `battle:${battleId}:results`
  const results = (await kvClient.get<Record<string, GameResult>>(key)) || {}
  results[modelId] = result
  await kvClient.set(key, results)
}

export async function getCompletedBattle(battleId: string): Promise<CompletedBattle | null> {
  const kvClient = getKv()
  const metadata = await kvClient.get<BattleMetadata>(`battle:${battleId}`)
  if (!metadata) return null

  const frames = new Map<AuthorizedModel, BattleFrame[]>()
  const results = new Map<AuthorizedModel, GameResult>()

  const resultsData = await kvClient.get<Record<string, GameResult>>(`battle:${battleId}:results`)
  if (resultsData) {
    for (const [modelId, result] of Object.entries(resultsData)) {
      results.set(modelId as AuthorizedModel, result)
    }
  }

  for (const modelId of metadata.models) {
    const modelFrames = await kvClient.get<BattleFrame[]>(`battle:${battleId}:frames:${modelId}`)
    if (modelFrames) {
      frames.set(modelId, modelFrames)
    } else {
      frames.set(modelId, [])
    }
  }

  return {
    id: metadata.id,
    config: metadata.config,
    models: metadata.models,
    status: metadata.status,
    rankings: metadata.rankings,
    boardSeed: metadata.boardSeed,
    createdAt: metadata.createdAt,
    completedAt: metadata.completedAt,
    frames,
    results,
  }
}

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
