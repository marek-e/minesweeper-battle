import { Redis } from '@upstash/redis'
import { GameConfig, GameResult, BoardState } from '../types'
import { AuthorizedModel } from '../battleConfig'
import { BattleMetadata } from './battle'

// Use globalThis to persist across module reloads in dev
const globalForDb = globalThis as unknown as {
  inMemoryStore: Map<string, unknown>
  inMemorySortedSet: Map<string, Array<{ score: number; member: string }>>
}

const inMemoryStore = globalForDb.inMemoryStore ?? new Map<string, unknown>()
const inMemorySortedSet =
  globalForDb.inMemorySortedSet ?? new Map<string, Array<{ score: number; member: string }>>()

if (!globalForDb.inMemoryStore) {
  globalForDb.inMemoryStore = inMemoryStore
  globalForDb.inMemorySortedSet = inMemorySortedSet
}

if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Using in-memory storage (Redis not configured). Data will be lost on restart.')
}

export function getKv() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv()
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Redis not configured')
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
  } as Redis
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
