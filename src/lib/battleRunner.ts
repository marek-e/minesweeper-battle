import { generateText, LanguageModel, tool, APICallError } from 'ai'
import { z } from 'zod'
import { createBoard, flagCell, revealCell, encodeBoardForLLM } from '@/lib/minesweeper'
import type { BoardState, GameOutcome, Ranking } from '@/lib/types'
import { AuthorizedModel } from '@/lib/battleConfig'
import { calculateScore } from './scoring'
import { getResults, insertFrame, insertResult } from './database/db'
import { getBattleMetadata, updateBattleCompletion } from './database/battle'
import {
  initializeModelState,
  getModelState,
  updateModelState,
  PersistedModelState,
} from './database/modelState'

const models: Record<AuthorizedModel, LanguageModel> = {
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'claude-3.7-sonnet': 'anthropic/claude-3.7-sonnet',
  'grok-code-fast-1': 'xai/grok-code-fast-1',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'gemini-3-pro-preview': 'google/gemini-3-pro-preview',
  'claude-sonnet-4.5': 'anthropic/claude-sonnet-4.5',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'grok-4-fast-reasoning': 'xai/grok-4-fast-reasoning',
  'deepseek-v3.2': 'deepseek/deepseek-v3.2',
}

const MAX_MOVES = 60
const MAX_RETRIES = 3

export async function executeModelMove(
  battleId: string,
  modelId: AuthorizedModel
): Promise<PersistedModelState> {
  const battleMeta = await getBattleMetadata(battleId)
  if (!battleMeta) {
    throw new Error(`Battle ${battleId} not found`)
  }

  const { config, minePositions } = battleMeta

  await initializeModelState(battleId, modelId)
  const modelState = await getModelState(battleId, modelId)
  if (!modelState) {
    throw new Error(`Failed to initialize model state for ${modelId}`)
  }

  // Check if already complete
  if (modelState.outcome !== 'playing') {
    return modelState
  }

  // Check move limit
  if (modelState.moves >= MAX_MOVES) {
    const finalState: typeof modelState = {
      ...modelState,
      outcome: 'stuck',
    }
    await updateModelState(battleId, modelId, finalState)

    return finalState
  }

  // Load current board state
  let board: BoardState | null = modelState.boardState
  let prevBoard: BoardState | null = modelState.prevBoardState
  let moves = modelState.moves
  let safeRevealed = modelState.safeRevealed
  let outcome: GameOutcome = modelState.outcome
  let minesHit = modelState.minesHit
  const totalSafeCells = config.rows * config.cols - config.mineCount

  // Execute one LLM turn with retries
  let retries = 0
  let moveSuccessful = false

  while (retries < MAX_RETRIES && !moveSuccessful && outcome === 'playing') {
    try {
      const boardString = board
        ? encodeBoardForLLM(board)
        : 'The board is empty. Make your first move.'

      const systemPrompt = `
You are a Minesweeper player. Your goal is to win by revealing all safe cells.
The board is a ${config.rows}x${config.cols} grid with ${config.mineCount} hidden mines.
You will be given the current board state and must return your next move in JSON format.
'H' means a hidden cell. 'F' means a flagged cell. A number (0-8) means a revealed cell showing adjacent mines.
Rows and columns are 0-indexed. Your move must be on a hidden, unflagged cell.
Choose your action and coordinates carefully based on the visible numbers.
`

      // IMPORTANT: You can submit multiple moves at once using makeMoves if you're confident they are safe.
      // This is faster than one move at a time. Batch obvious safe cells together (e.g., cells adjacent to 0s).
      // Use makeMove for single cautious moves, and makeMoves for batches of confident moves.

      const { toolResults } = await generateText({
        model: models[modelId],
        system: systemPrompt,
        prompt: `Current board:\n${boardString}\n\nWhat is your next move?`,
        toolChoice: 'required',
        tools: {
          makeMove: tool({
            description:
              'Make a single move by revealing or flagging a cell. Use for cautious moves.',
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
                // Use pre-generated mine positions for identical grid across all models
                board = createBoard(config, undefined, minePositions)
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

              // Save frame
              const frameIndex = modelState.moves
              await insertFrame(battleId, modelId, frameIndex, action, row, col, boardStateCopy)

              prevBoard = boardStateCopy

              return { success: true, row, col }
            },
          }),
          // makeMoves: tool({
          //   description:
          //     'Make multiple moves at once. Use for cells you are confident about (e.g., cells adjacent to 0s). Batch obvious safe cells together.',
          //   inputSchema: z.object({
          //     moves: z
          //       .array(
          //         z.object({
          //           action: z.enum(['reveal', 'flag']),
          //           row: z
          //             .number()
          //             .int()
          //             .min(0)
          //             .max(config.rows - 1),
          //           col: z
          //             .number()
          //             .int()
          //             .min(0)
          //             .max(config.cols - 1),
          //         })
          //       )
          //       .min(1)
          //       .max(20),
          //     reasoning: z
          //       .string()
          //       .describe('A short explanation for why these moves are safe.')
          //       .optional(),
          //   }),
          //   execute: async ({ moves: moveList }) => {
          //     const executedMoves: Array<{
          //       action: 'reveal' | 'flag'
          //       row: number
          //       col: number
          //     }> = []

          //     for (const move of moveList) {
          //       // Stop if game is over
          //       if (outcome !== 'playing') {
          //         break
          //       }

          //       // Initialize board on first move if needed
          //       if (!board) {
          //         // Use pre-generated mine positions for identical grid across all models
          //         board = createBoard(config, undefined, minePositions)
          //       }

          //       const cell = board[move.row][move.col]
          //       if (cell.isRevealed || (move.action === 'reveal' && cell.isFlagged)) {
          //         break
          //       }

          //       if (move.action === 'reveal') {
          //         const { revealedCount, hitMine } = revealCell(board, move.row, move.col)
          //         if (hitMine) {
          //           outcome = 'loss'
          //           minesHit = 1
          //           executedMoves.push(move)
          //           moves++
          //           moveSuccessful = true

          //           const boardStateCopy = JSON.parse(JSON.stringify(board)) as BoardState

          //           // Save frame
          //           const frameIndex = modelState.moves + executedMoves.length - 1
          //           await insertFrame(
          //             battleId,
          //             modelId,
          //             frameIndex,
          //             move.action,
          //             move.row,
          //             move.col,
          //             boardStateCopy
          //           )

          //           prevBoard = boardStateCopy
          //           break
          //         }
          //         safeRevealed += revealedCount
          //       } else if (move.action === 'flag') {
          //         flagCell(board, move.row, move.col)
          //       }

          //       executedMoves.push(move)
          //       moves++
          //       moveSuccessful = true

          //       const boardStateCopy = JSON.parse(JSON.stringify(board)) as BoardState

          //       // Save frame
          //       const frameIndex = modelState.moves + executedMoves.length - 1
          //       await insertFrame(
          //         battleId,
          //         modelId,
          //         frameIndex,
          //         move.action,
          //         move.row,
          //         move.col,
          //         boardStateCopy
          //       )

          //       prevBoard = boardStateCopy
          //     }

          //     return {
          //       success: true,
          //       executed: executedMoves.length,
          //       total: moveList.length,
          //       stoppedEarly: executedMoves.length < moveList.length,
          //     }
          //   },
          // }),
        },
      })

      if (!toolResults || toolResults.length === 0) {
        throw new Error('No move was made.')
      }
    } catch (error) {
      retries++
      console.error(`[${modelId}] Error on move ${moves + 1}, retry ${retries}:`, error)

      const isCreditError =
        (APICallError.isInstance(error) &&
          (error.statusCode === 402 || error.statusCode === 429)) ||
        (error instanceof Error &&
          /insufficient|quota|credit|billing|exceeded/i.test(error.message))

      if (isCreditError || retries >= MAX_RETRIES) {
        outcome = 'error'

        const finalState: typeof modelState = {
          ...modelState,
          outcome: 'error',
        }
        await updateModelState(battleId, modelId, finalState)

        return finalState
      }
    }
  }

  if (safeRevealed === totalSafeCells && outcome === 'playing') {
    outcome = 'win'
  }

  const finalState: typeof modelState = {
    ...modelState,
    boardState: board,
    prevBoardState: prevBoard,
    moves,
    safeRevealed,
    minesHit,
    outcome,
  }
  await updateModelState(battleId, modelId, finalState)
  return finalState
}

export async function calculateScoreAndInsertResult(
  battleId: string,
  modelId: AuthorizedModel,
  modelState: PersistedModelState
): Promise<void> {
  const { outcome, safeRevealed, moves, minesHit } = modelState
  const battleMeta = await getBattleMetadata(battleId)
  if (!battleMeta) {
    throw new Error(`Battle ${battleId} not found`)
  }
  const { config } = battleMeta
  const score = calculateScore({
    outcome,
    safeRevealed,
    moves,
    minesHit,
    config,
  })

  await insertResult(battleId, modelId, {
    modelId,
    outcome,
    score,
    moves,
    durationMs: Date.now() - modelState.startTime,
    safeRevealed,
    totalSafe: config.rows * config.cols - config.mineCount,
    minesHit,
  })
}

export async function updateOnAllModelsComplete(battleId: string): Promise<void> {
  const battleMeta = await getBattleMetadata(battleId)
  if (!battleMeta) {
    throw new Error(`Battle ${battleId} not found`)
  }

  const { models } = battleMeta
  const modelStates = await Promise.all(
    models.map(async (modelId) => await getModelState(battleId, modelId))
  )
  const allComplete = modelStates.every((state) => state !== null && state.outcome !== 'playing')

  if (!allComplete) {
    return
  }

  const results = await getResults(battleId)
  const rankings: Ranking = Object.entries(results)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([modelId, result], index) => {
      return {
        modelId,
        rank: index + 1,
        score: result.score,
      }
    })

  await updateBattleCompletion(battleId, 'complete', rankings)
}
