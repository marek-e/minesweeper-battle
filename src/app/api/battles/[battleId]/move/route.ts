import { NextRequest, NextResponse } from 'next/server'
import {
  calculateScoreAndInsertResult,
  executeModelMove,
  updateOnAllModelsComplete,
} from '@/lib/battleRunner'
import { AUTHORIZED_MODELS } from '@/lib/battleConfig'
import type { AuthorizedModel } from '@/lib/battleConfig'
import { getBattleMetadata } from '@/lib/database/battle'
import { PersistedModelState } from '@/lib/database/modelState'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
): Promise<NextResponse<PersistedModelState | { error: string }>> {
  try {
    const { battleId } = await params
    const searchParams = request.nextUrl.searchParams
    const modelParam = searchParams.get('model')

    if (!modelParam) {
      return NextResponse.json({ error: 'Missing model parameter' }, { status: 400 })
    }

    if (!AUTHORIZED_MODELS.includes(modelParam as AuthorizedModel)) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
    }

    const modelId = modelParam as AuthorizedModel

    const battleMeta = await getBattleMetadata(battleId)
    if (!battleMeta) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    }

    if (!battleMeta.models.includes(modelId)) {
      return NextResponse.json({ error: 'Model not part of this battle' }, { status: 400 })
    }

    // Execute one move
    console.info('[API] Executing move for model:', modelId)
    const state = await executeModelMove(battleId, modelId)
    console.info('[API] Move result:', state)
    if (state.outcome !== 'playing') {
      await calculateScoreAndInsertResult(battleId, modelId, state)
    }
    await updateOnAllModelsComplete(battleId)
    return NextResponse.json(state)
  } catch (error) {
    console.error('Error executing move:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
