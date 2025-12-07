export const AUTHORIZED_MODELS = [
  // OpenAI
  'gpt-5-mini',
  'gpt-4.1-mini',
  // Google
  'gemini-2.5-flash',
  'gemini-3-pro-preview',
  // Anthropic
  'claude-3.7-sonnet',
  'claude-sonnet-4.5',
  'claude-haiku-4.5',
  // Grok
  'grok-code-fast-1',
  'grok-4-fast-reasoning',
  // DeepSeek
  'deepseek-v3.2',
] as const

export type AuthorizedModel = (typeof AUTHORIZED_MODELS)[number]

export const MAX_ROWS = 30
export const MAX_COLS = 30
export const MAX_MINES = 200
