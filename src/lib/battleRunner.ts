import { generateText, LanguageModel, tool } from 'ai'
import { z } from 'zod'
import {
  createBoard,
  flagCell,
  generateMinePositions,
  getVisibleBoard,
  revealCell,
} from '@/lib/minesweeper'
import type { BoardState, GameConfig, GameOutcome } from '@/lib/types'
import { AuthorizedModel } from '@/lib/battleConfig'
import { battleStore } from './battleStore'
import { calculateScore } from './scoring'

const models: Record<AuthorizedModel, LanguageModel> = {
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'claude-3.7-sonnet': 'anthropic/claude-3.7-sonnet',
  'grok-code-fast-1': 'xai/grok-code-fast-1',
}

const MAX_MOVES = 60
const MAX_RETRIES = 3

function formatBoardForLLM(board: (string | number)[][]): string {
  return board.map((row) => row.map((cell) => String(cell).padStart(2, ' ')).join(' ')).join('\n')
}

async function runModelSimulation(
  battleId: string,
  modelId: AuthorizedModel,
  config: GameConfig,
  boardSeed: number,
  onMove: (boardState: BoardState, action: 'reveal' | 'flag', row: number, col: number) => void
): Promise<{
  outcome: GameOutcome
  moves: number
  durationMs: number
  safeRevealed: number
  minesHit: 0 | 1
}> {
  const startTime = Date.now()
  let board: BoardState | null = null
  let moves = 0
  let safeRevealed = 0
  let outcome: GameOutcome = 'playing'
  let minesHit: 0 | 1 = 0

  const totalSafeCells = config.rows * config.cols - config.mineCount

  while (outcome === 'playing' && moves < MAX_MOVES) {
    let retries = 0
    let moveSuccessful = false

    while (retries < MAX_RETRIES && !moveSuccessful) {
      try {
        const visibleBoard = board ? getVisibleBoard(board) : null
        const boardString = visibleBoard
          ? formatBoardForLLM(visibleBoard)
          : 'The board is empty. Make your first move.'

        const systemPrompt = `
You are a Minesweeper player. Your goal is to win by revealing all safe cells.
The board is a ${config.rows}x${config.cols} grid with ${config.mineCount} hidden mines.
You will be given the current board state and must return your next move in JSON format.
'H' means a hidden cell. 'F' means a flagged cell. A number (0-8) means a revealed cell showing adjacent mines.
Rows and columns are 0-indexed. Your move must be on a hidden, unflagged cell.
Choose your action and coordinates carefully based on the visible numbers.
`

        const { toolResults } = await generateText({
          model: models[modelId],
          system: systemPrompt,
          prompt: `Current board:\n${boardString}\n\nWhat is your next move?`,
          tools: {
            makeMove: tool({
              description: 'Make a move by revealing or flagging a cell.',
              inputSchema: z.object({
                action: z.enum(['reveal', 'flag']),
                row: z
                  .number()
                  .int()
                  .min(0)
                  .max(config.rows - 1),
                col: z
                  .number()
                  .int()
                  .min(0)
                  .max(config.cols - 1),
                reasoning: z.string().describe('A short explanation for your move.').optional(),
              }),
              execute: async ({ action, row, col }) => {
                if (!board) {
                  const minePositions = generateMinePositions(config, boardSeed, { row, col })
                  board = createBoard(config, { row, col }, minePositions)
                }

                const cell = board[row][col]
                if (cell.isRevealed || (action === 'reveal' && cell.isFlagged)) {
                  throw new Error('Invalid move: Cell is not available.')
                }

                if (action === 'reveal') {
                  const { revealedCount, hitMine } = revealCell(board, row, col)
                  if (hitMine) {
                    outcome = 'loss'
                    minesHit = 1
                  }
                  safeRevealed += revealedCount - (hitMine ? 1 : 0)
                } else if (action === 'flag') {
                  flagCell(board, row, col)
                }

                moves++
                moveSuccessful = true

                const boardStateCopy = JSON.parse(JSON.stringify(board)) as BoardState
                onMove(boardStateCopy, action, row, col)

                return { success: true, row, col }
              },
            }),
          },
        })

        if (!toolResults || toolResults.length === 0) {
          throw new Error('No move was made.')
        }
      } catch (error) {
        console.error(`[${modelId}] Error on move ${moves + 1}, retry ${retries + 1}:`, error)
        retries++
        if (retries >= MAX_RETRIES) {
          outcome = 'error'
        }
      }
    }

    if (!moveSuccessful) {
      if (outcome !== 'error') outcome = 'stuck'
      break
    }

    if (safeRevealed === totalSafeCells) {
      outcome = 'win'
    }
  }

  if (outcome === 'playing') {
    outcome = 'stuck'
  }

  const durationMs = Date.now() - startTime

  return {
    outcome,
    moves,
    durationMs,
    safeRevealed,
    minesHit,
  }
}

export async function runBattle(battleId: string): Promise<void> {
  const battle = battleStore.getBattle(battleId)
  if (!battle) {
    throw new Error(`Battle ${battleId} not found`)
  }

  const { config, models } = battle

  const boardSeed = Math.floor(Math.random() * 2147483647)

  battleStore.emit(battleId, {
    type: 'init',
    config,
    models,
  })

  const promises = models.map(async (modelId) => {
    try {
      const result = await runModelSimulation(
        battleId,
        modelId,
        config,
        boardSeed,
        (boardState, action, row, col) => {
          battleStore.emit(battleId, {
            type: 'move',
            modelId,
            action,
            row,
            col,
            boardState,
          })
        }
      )

      battleStore.emit(battleId, {
        type: 'complete',
        modelId,
        outcome: result.outcome,
        moves: result.moves,
        safeRevealed: result.safeRevealed,
        minesHit: result.minesHit,
        durationMs: result.durationMs,
      })

      return {
        modelId,
        ...result,
      }
    } catch (error) {
      console.error(`[${modelId}] Battle error:`, error)
      battleStore.emit(battleId, {
        type: 'complete',
        modelId,
        outcome: 'error',
        moves: 0,
        safeRevealed: 0,
        minesHit: 0,
        durationMs: 0,
      })
      return {
        modelId,
        outcome: 'error' as GameOutcome,
        moves: 0,
        durationMs: 0,
        safeRevealed: 0,
        minesHit: 0,
      }
    }
  })

  const results = await Promise.allSettled(promises)

  const fullResults = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((result) => {
      const battle = battleStore.getBattle(battleId)
      const modelState = battle?.modelStates.get(result.modelId)
      const minesHit = modelState?.minesHit ?? result.minesHit

      const score = calculateScore({
        outcome: result.outcome,
        safeRevealed: result.safeRevealed,
        moves: result.moves,
        minesHit: minesHit as 0 | 1,
        config,
      })

      return {
        modelId: result.modelId,
        outcome: result.outcome,
        score,
        moves: result.moves,
        durationMs: result.durationMs,
        safeRevealed: result.safeRevealed,
        totalSafe: config.rows * config.cols - config.mineCount,
        minesHit: minesHit as 0 | 1,
      }
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      const outcomeOrder: Record<GameOutcome, number> = {
        win: 1,
        stuck: 2,
        loss: 3,
        error: 4,
        playing: 5,
      }
      if (outcomeOrder[a.outcome] !== outcomeOrder[b.outcome]) {
        return outcomeOrder[a.outcome] - outcomeOrder[b.outcome]
      }
      if (a.moves !== b.moves) return a.moves - b.moves
      return a.durationMs - b.durationMs
    })

  battleStore.emit(battleId, {
    type: 'done',
    rankings: fullResults,
  })
}
