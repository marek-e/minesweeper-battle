import { NextRequest, NextResponse } from 'next/server'
import { listBattles, countBattles } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const battles = await listBattles(status || null, limit, offset)
    const total = await countBattles(status || null)

    return NextResponse.json({
      battles,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error listing battles:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
