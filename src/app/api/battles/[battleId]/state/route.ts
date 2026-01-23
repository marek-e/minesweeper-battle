import { NextRequest, NextResponse } from 'next/server'
import { BattleMetadata, getBattleMetadata } from '@/lib/database/battle'
import { getModelState, PersistedModelState } from '@/lib/database/modelState'

export type BattleState = {
  battleMetadata: BattleMetadata | null
  modelStates: Record<string, PersistedModelState>
  status?: 'idle' | 'loading' | 'running' | 'complete' | 'error'
  error?: { message: string; code: 'credit_exhausted' | 'unknown' }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
): Promise<NextResponse<BattleState | { error: string }>> {
  try {
    const { battleId } = await params

    const battleMetadata = await getBattleMetadata(battleId)
    if (!battleMetadata) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    }
    console.debug('[API] State: Battle metadata:', battleMetadata)

    // Load all model states
    const modelStates = new Map<string, PersistedModelState>()

    for (const modelId of battleMetadata.models) {
      const modelState = await getModelState(battleId, modelId)
      console.debug('[API] State: Model state:', modelState)
      if (modelState) {
        modelStates.set(modelId, modelState)
      } else {
        console.error(`Model state not found for ${modelId}`)
      }
    }

    return NextResponse.json({
      battleMetadata,
      modelStates: Object.fromEntries(modelStates),
    })
  } catch (error) {
    console.error('Error fetching battle state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
