export const AUTHORIZED_MODELS = [
  'gpt-5-mini',
  'gemini-2.5-flash',
  'claude-3.7-sonnet',
  'grok-code-fast-1',
] as const

export type AuthorizedModel = (typeof AUTHORIZED_MODELS)[number]

export const MAX_ROWS = 30
export const MAX_COLS = 30
export const MAX_MINES = 200
