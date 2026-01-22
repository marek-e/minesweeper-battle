import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { insertBattle, initializeModelState } from '@/lib/db'
import { AUTHORIZED_MODELS, MAX_ROWS, MAX_COLS, MAX_MINES } from '@/lib/battleConfig'

const createBattleSchema = z
  .object({
    rows: z.number().int().min(1).max(MAX_ROWS),
    cols: z.number().int().min(1).max(MAX_COLS),
    mineCount: z.number().int().min(1).max(MAX_MINES),
    models: z.array(z.enum(AUTHORIZED_MODELS)).min(1).max(10),
  })
  .refine((data) => data.mineCount < data.rows * data.cols, {
    message: 'mineCount must be less than total cells',
    path: ['mineCount'],
  })

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = createBattleSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error.issues },
        { status: 400 }
      )
    }

    const { rows, cols, mineCount, models } = result.data

    const boardSeed = Math.floor(Math.random() * 2147483647)
    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Create battle in DB
    await insertBattle(battleId, { rows, cols, mineCount }, models, boardSeed)
    console.log('Battle created in DB:', battleId)

    // Initialize model states in DB
    await Promise.all(models.map((modelId) => initializeModelState(battleId, modelId)))

    return NextResponse.json({ battleId })
  } catch (error) {
    console.error('Error creating battle:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
