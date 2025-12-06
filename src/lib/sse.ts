/**
 * Server-Sent Events utilities
 */

export type SSEController = {
  send: (event: string, data: unknown) => void
  close: () => void
}

export function createSSEController(
  controller: ReadableStreamDefaultController<Uint8Array>
): SSEController {
  const encoder = new TextEncoder()

  return {
    send(event: string, data: unknown) {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(message))
    },
    close() {
      controller.close()
    },
  }
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const
