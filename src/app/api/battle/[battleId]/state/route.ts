import { NextRequest, NextResponse } from 'next/server'
import { getBattleMetadata, getModelState } from '@/lib/db'
import { encodeBoard } from '@/lib/minesweeper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
) {
  try {
    const { battleId } = await params
    
    const battleMeta = await getBattleMetadata(battleId)
    if (!battleMeta) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    }

    // Load all model states
    const modelStates: Record<string, {
      moves: number
      safeRevealed: number
      minesHit: 0 | 1
      outcome?: string
      compactBoard?: string
      status: 'pending' | 'playing' | 'complete'
    }> = {}

    for (const modelId of battleMeta.models) {
      const modelState = await getModelState(battleId, modelId)
      if (modelState) {
        modelStates[modelId] = {
          moves: modelState.moves,
          safeRevealed: modelState.safeRevealed,
          minesHit: modelState.minesHit,
          outcome: modelState.outcome,
          compactBoard: modelState.boardState ? encodeBoard(modelState.boardState) : undefined,
          status: modelState.outcome && modelState.outcome !== 'playing' ? 'complete' : modelState.moves > 0 ? 'playing' : 'pending',
        }
      } else {
        modelStates[modelId] = {
          moves: 0,
          safeRevealed: 0,
          minesHit: 0,
          status: 'pending',
        }
      }
    }

    return NextResponse.json({
      config: battleMeta.config,
      models: battleMeta.models,
      modelStates,
      rankings: battleMeta.rankings,
      status: battleMeta.status,
    })
  } catch (error) {
    console.error('Error fetching battle state:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
