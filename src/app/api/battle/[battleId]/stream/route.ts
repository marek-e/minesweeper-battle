import { NextRequest } from 'next/server'
import { battleStore, BattleEvent, BattleState } from '@/lib/battleStore'
import { createSSEController, SSEController, SSE_HEADERS } from '@/lib/sse'
import { encodeBoard, getDelta } from '@/lib/minesweeper'

// ─────────────────────────────────────────────────────────────────────────────
// Event Payloads - Single source of truth for SSE data shapes
// ─────────────────────────────────────────────────────────────────────────────

const eventPayloads = {
  init: (event: Extract<BattleEvent, { type: 'init' }>) => ({
    config: event.config,
    models: event.models,
  }),

  move: (event: Extract<BattleEvent, { type: 'move' }>) => ({
    modelId: event.modelId,
    action: event.action,
    row: event.row,
    col: event.col,
    board: event.board,
    delta: event.delta,
  }),

  complete: (event: Extract<BattleEvent, { type: 'complete' }>) => ({
    modelId: event.modelId,
    outcome: event.outcome,
    moves: event.moves,
    safeRevealed: event.safeRevealed,
    minesHit: event.minesHit,
    durationMs: event.durationMs,
  }),

  done: (event: Extract<BattleEvent, { type: 'done' }>) => ({
    rankings: event.rankings,
  }),

  error: (event: Extract<BattleEvent, { type: 'error' }>) => ({
    error: event.error,
    code: event.code,
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

function sendBattleEvent(sse: SSEController, event: BattleEvent): boolean {
  const payload = eventPayloads[event.type](event as never)
  sse.send(event.type, payload)
  return event.type === 'done' || event.type === 'error'
}

function sendCatchupEvents(sse: SSEController, battle: BattleState): boolean {
  // Send init
  sse.send('init', {
    config: battle.config,
    models: battle.models,
  })

  // Send latest board state for each model
  for (const [modelId, state] of battle.modelStates) {
    if (state.boardState) {
      const delta = getDelta(state.prevBoardState, state.boardState)
      sse.send('move', {
        modelId,
        action: 'reveal' as const,
        row: 0,
        col: 0,
        board: encodeBoard(state.boardState),
        delta: delta.length > 0 ? delta : undefined,
      })
    }

    // Send completion if model finished
    if (state.status === 'complete' && state.outcome) {
      sse.send('complete', {
        modelId,
        outcome: state.outcome,
        moves: state.moves,
        safeRevealed: state.safeRevealed,
        minesHit: state.minesHit,
        durationMs: state.durationMs,
      })
    }
  }

  // Send done if battle complete
  if (battle.status === 'complete' && battle.rankings) {
    sse.send('done', { rankings: battle.rankings })
    return true // Signal to close stream
  }

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ battleId: string }> }
) {
  const { battleId } = await params
  const battle = battleStore.getBattle(battleId)

  if (!battle) {
    return new Response('Battle not found', { status: 404 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const sse = createSSEController(controller)
      let shouldClose = false

      // Subscribe to live events
      const unsubscribe = battleStore.subscribe(battleId, (event) => {
        try {
          const isDone = sendBattleEvent(sse, event)
          if (isDone) {
            console.log('🚀 ~ sendBattleEvent ~ isDone -> close stream')
            shouldClose = true
            setTimeout(() => sse.close(), 100)
          }
        } catch (error) {
          console.error('Error sending SSE event:', error)
        }
      })

      // Send catchup events for late-joining clients
      if (battle.status !== 'pending') {
        const isDone = sendCatchupEvents(sse, battle)
        if (isDone) {
          console.log('🚀 ~ sendCatchupEvents ~ isDone -> close stream')
          shouldClose = true
          setTimeout(() => sse.close(), 100)
        }
      }

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        if (!shouldClose) {
          sse.close()
        }
      })
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
