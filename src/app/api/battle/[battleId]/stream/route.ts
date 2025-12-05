import { NextRequest } from 'next/server'
import { battleStore } from '@/lib/battleStore'

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
      const encoder = new TextEncoder()

      const sendEvent = (event: string, data: unknown) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      const unsubscribe = battleStore.subscribe(battleId, (event) => {
        try {
          switch (event.type) {
            case 'init':
              sendEvent('init', {
                config: event.config,
                models: event.models,
              })
              break

            case 'move':
              sendEvent('move', {
                modelId: event.modelId,
                action: event.action,
                row: event.row,
                col: event.col,
                boardState: event.boardState,
              })
              break

            case 'complete':
              sendEvent('complete', {
                modelId: event.modelId,
                outcome: event.outcome,
                moves: event.moves,
                safeRevealed: event.safeRevealed,
                minesHit: event.minesHit,
                durationMs: event.durationMs,
              })
              break

            case 'done':
              sendEvent('done', {
                rankings: event.rankings,
              })
              setTimeout(() => {
                controller.close()
              }, 100)
              break
          }
        } catch (error) {
          console.error('Error sending SSE event:', error)
        }
      })

      if (battle.status !== 'pending') {
        sendEvent('init', {
          config: battle.config,
          models: battle.models,
        })

        battle.modelStates.forEach((state, modelId) => {
          if (state.boardState) {
            sendEvent('move', {
              modelId,
              action: 'reveal' as const,
              row: 0,
              col: 0,
              boardState: state.boardState,
            })
          }

          if (state.status === 'complete' && state.outcome) {
            sendEvent('complete', {
              modelId,
              outcome: state.outcome,
              moves: state.moves,
              safeRevealed: state.safeRevealed,
              minesHit: state.minesHit,
              durationMs: state.durationMs,
            })
          }
        })

        if (battle.status === 'complete' && battle.rankings) {
          sendEvent('done', {
            rankings: battle.rankings,
          })
          setTimeout(() => {
            controller.close()
          }, 100)
        }
      }

      request.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

