import { NextRequest, NextResponse } from 'next/server'
import { executeModelMove } from '@/lib/battleRunner'
import { getBattleMetadata } from '@/lib/db'
import { AUTHORIZED_MODELS } from '@/lib/battleConfig'
import type { AuthorizedModel } from '@/lib/battleConfig'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
) {
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

    // Verify battle exists
    const battleMeta = await getBattleMetadata(battleId)
    if (!battleMeta) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 })
    }

    // Verify model is part of this battle
    if (!battleMeta.models.includes(modelId)) {
      return NextResponse.json({ error: 'Model not part of this battle' }, { status: 400 })
    }

    // Execute one move
    console.log('Executing move for model:', modelId)
    const result = await executeModelMove(battleId, modelId)
    console.log('Move result:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error executing move:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
