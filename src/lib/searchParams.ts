import {
  parseAsInteger,
  parseAsArrayOf,
  parseAsString,
  parseAsStringEnum,
  createLoader,
} from 'nuqs/server'
import { AUTHORIZED_MODELS } from './battleConfig'

export const gameSearchParams = {
  rows: parseAsInteger.withDefault(16),
  cols: parseAsInteger.withDefault(16),
  mineCount: parseAsInteger.withDefault(40),
  models: parseAsArrayOf(parseAsStringEnum(AUTHORIZED_MODELS as unknown as string[])).withDefault([
    'gpt-5-mini',
    'gemini-2.5-flash',
  ]),
  battleId: parseAsString,
}

export const loadGameSearchParams = createLoader(gameSearchParams)
