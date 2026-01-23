import { Difficulty, GameConfig } from './types'

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

export const MODEL_NAMES: Record<AuthorizedModel, string> = {
  'gpt-5-mini': 'GPT-5 Mini',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
  'grok-code-fast-1': 'Grok Code Fast 1',
  'gpt-4.1-mini': 'GPT-4.1 Mini',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-haiku-4.5': 'Claude Haiku 4.5',
  'grok-4-fast-reasoning': 'Grok 4 Fast Reasoning',
  'deepseek-v3.2': 'DeepSeek V3.2',
}

export const DIFFICULTIES: Record<Difficulty, GameConfig> = {
  beginner: { rows: 9, cols: 9, mineCount: 10 },
  intermediate: { rows: 16, cols: 16, mineCount: 40 },
  expert: { rows: 16, cols: 30, mineCount: 99 },
}
