import { generateText, LanguageModel, tool, APICallError } from 'ai'
import { z } from 'zod'
import {
  createBoard,
  flagCell,
  revealCell,
  encodeBoard,
  encodeBoardForLLM,
} from '@/lib/minesweeper'
import type { BoardState, GameOutcome } from '@/lib/types'
import { AuthorizedModel } from '@/lib/battleConfig'
import { calculateScore } from './scoring'
import {
  getBattleMetadata,
  getModelState,
  updateModelState,
  initializeModelState,
  insertFrame,
  insertResult,
} from './db'
import type { GameResult } from './types'

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

export type MoveResult = {
  success: boolean
  completed: boolean
  outcome?: GameOutcome
  moves: number
  safeRevealed: number
  minesHit: 0 | 1
  durationMs: number
  error?: string
  boardState: BoardState | null
  compactBoard?: string
  allModelsComplete?: boolean
  rankings?: GameResult[]
}

export async function executeModelMove(
  battleId: string,
  modelId: AuthorizedModel
): Promise<MoveResult> {
  // Load battle metadata
  const battleMeta = await getBattleMetadata(battleId)
  if (!battleMeta) {
    throw new Error(`Battle ${battleId} not found`)
  }

  const { config, minePositions } = battleMeta

  // Initialize or load model state
  await initializeModelState(battleId, modelId)
  const modelState = await getModelState(battleId, modelId)
  if (!modelState) {
    throw new Error(`Failed to initialize model state for ${modelId}`)
  }

  // Check if already complete
  if (modelState.outcome && modelState.outcome !== 'playing') {
    return {
      success: true,
      completed: true,
      outcome: modelState.outcome,
      moves: modelState.moves,
      safeRevealed: modelState.safeRevealed,
      minesHit: modelState.minesHit,
      durationMs: Date.now() - modelState.startTime,
      boardState: modelState.boardState,
      compactBoard: modelState.boardState ? encodeBoard(modelState.boardState) : undefined,
    }
  }

  // Check move limit
  if (modelState.moves >= MAX_MOVES) {
    const finalState: typeof modelState = {
      ...modelState,
      outcome: 'stuck',
    }
    await updateModelState(battleId, modelId, finalState)

    const durationMs = Date.now() - modelState.startTime

    return {
      success: true,
      completed: true,
      outcome: 'stuck',
      moves: modelState.moves,
      safeRevealed: modelState.safeRevealed,
      minesHit: modelState.minesHit,
      durationMs,
      boardState: modelState.boardState,
      compactBoard: modelState.boardState ? encodeBoard(modelState.boardState) : undefined,
    }
  }

  // Load current board state
  let board: BoardState | null = modelState.boardState
  let prevBoard: BoardState | null = modelState.prevBoardState
  let moves = modelState.moves
  let safeRevealed = modelState.safeRevealed
  let outcome: GameOutcome = modelState.outcome || 'playing'
  let minesHit: 0 | 1 = modelState.minesHit
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

IMPORTANT: You can submit multiple moves at once using makeMoves if you're confident they are safe.
This is faster than one move at a time. Batch obvious safe cells together (e.g., cells adjacent to 0s).
Use makeMove for single cautious moves, and makeMoves for batches of confident moves.
`

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
          makeMoves: tool({
            description:
              'Make multiple moves at once. Use for cells you are confident about (e.g., cells adjacent to 0s). Batch obvious safe cells together.',
            inputSchema: z.object({
              moves: z
                .array(
                  z.object({
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
                  })
                )
                .min(1)
                .max(20),
              reasoning: z
                .string()
                .describe('A short explanation for why these moves are safe.')
                .optional(),
            }),
            execute: async ({ moves: moveList }) => {
              const executedMoves: Array<{
                action: 'reveal' | 'flag'
                row: number
                col: number
              }> = []

              for (const move of moveList) {
                // Stop if game is over
                if (outcome !== 'playing') {
                  break
                }

                // Initialize board on first move if needed
                if (!board) {
                  // Use pre-generated mine positions for identical grid across all models
                  board = createBoard(config, undefined, minePositions)
                }

                const cell = board[move.row][move.col]
                if (cell.isRevealed || (move.action === 'reveal' && cell.isFlagged)) {
                  break
                }

                if (move.action === 'reveal') {
                  const { revealedCount, hitMine } = revealCell(board, move.row, move.col)
                  if (hitMine) {
                    outcome = 'loss'
                    minesHit = 1
                    executedMoves.push(move)
                    moves++
                    moveSuccessful = true

                    const boardStateCopy = JSON.parse(JSON.stringify(board)) as BoardState

                    // Save frame
                    const frameIndex = modelState.moves + executedMoves.length - 1
                    await insertFrame(
                      battleId,
                      modelId,
                      frameIndex,
                      move.action,
                      move.row,
                      move.col,
                      boardStateCopy
                    )

                    prevBoard = boardStateCopy
                    break
                  }
                  safeRevealed += revealedCount
                } else if (move.action === 'flag') {
                  flagCell(board, move.row, move.col)
                }

                executedMoves.push(move)
                moves++
                moveSuccessful = true

                const boardStateCopy = JSON.parse(JSON.stringify(board)) as BoardState

                // Save frame
                const frameIndex = modelState.moves + executedMoves.length - 1
                await insertFrame(
                  battleId,
                  modelId,
                  frameIndex,
                  move.action,
                  move.row,
                  move.col,
                  boardStateCopy
                )

                prevBoard = boardStateCopy
              }

              return {
                success: true,
                executed: executedMoves.length,
                total: moveList.length,
                stoppedEarly: executedMoves.length < moveList.length,
              }
            },
          }),
        },
      })

      if (!toolResults || toolResults.length === 0) {
        throw new Error('No move was made.')
      }
    } catch (error) {
      console.error(`[${modelId}] Error on move ${moves + 1}, retry ${retries + 1}:`, error)

      const isCreditError =
        (APICallError.isInstance(error) &&
          (error.statusCode === 402 || error.statusCode === 429)) ||
        (error instanceof Error &&
          /insufficient|quota|credit|billing|exceeded/i.test(error.message))

      if (isCreditError) {
        outcome = 'error'

        const finalState: typeof modelState = {
          ...modelState,
          outcome: 'error',
        }
        await updateModelState(battleId, modelId, finalState)

        const durationMs = Date.now() - modelState.startTime

        return {
          success: false,
          completed: true,
          outcome: 'error',
          moves: modelState.moves,
          safeRevealed: modelState.safeRevealed,
          minesHit: modelState.minesHit,
          durationMs,
          boardState: null,
          error: error instanceof Error ? error.message : 'API credit exhausted',
        }
      }

      retries++
      if (retries >= MAX_RETRIES) {
        outcome = 'error'
      }
    }
  }

  // Check win condition
  if (safeRevealed === totalSafeCells && outcome === 'playing') {
    outcome = 'win'
  }

  // Check if stuck (no successful move)
  if (!moveSuccessful && outcome === 'playing') {
    outcome = 'stuck'
  }

  // Update final state
  if (outcome !== 'playing') {
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

    const durationMs = Date.now() - modelState.startTime

    // Calculate score and save result
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
      durationMs,
      safeRevealed,
      totalSafe: totalSafeCells,
      minesHit,
    })
  } else {
    // Update state for next move
    const updatedState: typeof modelState = {
      ...modelState,
      boardState: board,
      prevBoardState: prevBoard,
      moves,
      safeRevealed,
      minesHit,
      outcome,
    }
    await updateModelState(battleId, modelId, updatedState)
  }

  const durationMs = Date.now() - modelState.startTime

  // Check if all models are complete
  let allModelsComplete = false
  let rankings: GameResult[] | undefined
  
  if (outcome !== 'playing') {
    const allResults: GameResult[] = []
    let allComplete = true

    for (const modelId of battleMeta.models) {
      const modelState = await getModelState(battleId, modelId)
      if (!modelState || !modelState.outcome || modelState.outcome === 'playing') {
        allComplete = false
        break
      }

      const score = calculateScore({
        outcome: modelState.outcome,
        safeRevealed: modelState.safeRevealed,
        moves: modelState.moves,
        minesHit: modelState.minesHit,
        config: battleMeta.config,
      })

      allResults.push({
        modelId,
        outcome: modelState.outcome,
        score,
        moves: modelState.moves,
        durationMs: Date.now() - modelState.startTime,
        safeRevealed: modelState.safeRevealed,
        totalSafe: totalSafeCells,
        minesHit: modelState.minesHit,
      })
    }

    if (allComplete && allResults.length > 0) {
      allModelsComplete = true
      rankings = allResults.sort((a, b) => {
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
    }
  }

  return {
    success: moveSuccessful,
    completed: outcome !== 'playing',
    outcome: outcome !== 'playing' ? outcome : undefined,
    moves,
    safeRevealed,
    minesHit,
    durationMs,
    boardState: board,
    compactBoard: board ? encodeBoard(board) : undefined,
    allModelsComplete,
    rankings,
  }
}
