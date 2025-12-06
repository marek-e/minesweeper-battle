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
  let closed = false

  return {
    send(event: string, data: unknown) {
      if (closed) return
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(message))
    },
    close() {
      if (closed) return
      closed = true
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
