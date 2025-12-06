import { NextRequest, NextResponse } from 'next/server'
import { getCompletedBattle } from '@/lib/db'
import { BoardState, GameResult } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
) {
  try {
    const { battleId } = await params
    const battle = await getCompletedBattle(battleId)

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    }

    const frames: Record<
      string,
      Array<{
        frameIndex: number
        action: 'reveal' | 'flag' | null
        row: number | null
        col: number | null
        boardState: BoardState
      }>
    > = {}
    battle.frames.forEach((framesArray, modelId) => {
      frames[modelId] = framesArray
    })

    const results: Record<string, GameResult> = {}
    battle.results.forEach((result, modelId) => {
      results[modelId] = result
    })

    return NextResponse.json({
      id: battle.id,
      config: battle.config,
      models: battle.models,
      status: battle.status,
      rankings: battle.rankings,
      boardSeed: battle.boardSeed,
      createdAt: battle.createdAt,
      completedAt: battle.completedAt,
      frames,
      results,
    })
  } catch (error) {
    console.error('Error fetching battle:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
