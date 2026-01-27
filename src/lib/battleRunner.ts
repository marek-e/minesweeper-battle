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
      endTime: Date.now(),
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
        : `The board is empty (all cells are 'H'). First move tip: corners or center are good starting points—they tend to open up larger areas. Pick any cell to start.`

      const systemPrompt = `You are an expert Minesweeper player. Your goal: reveal ALL safe cells without hitting a mine.

## BOARD INFO
- Grid: ${config.rows} rows × ${config.cols} cols (0-indexed)
- Mines: ${config.mineCount} hidden mines
- Symbols: 'H' = hidden, 'F' = flagged, 0-8 = revealed (number of adjacent mines)

## CORE RULES
1. A number indicates EXACTLY how many mines are in the 8 adjacent cells (orthogonal + diagonal)
2. '0' means all 8 neighbors are safe → reveal them all
3. If a number equals its hidden neighbor count, ALL those hidden cells are mines
4. If a number's mine count is satisfied by flags, remaining hidden neighbors are SAFE

## WINNING STRATEGIES

### Pattern: Satisfied Numbers
If a cell shows '1' and has exactly 1 flagged/known mine neighbor → all other hidden neighbors are SAFE.
Example: A '2' with 2 adjacent flags means all other adjacent hidden cells are safe to reveal.

### Pattern: Forced Mines
If a '1' has only 1 hidden neighbor → that neighbor MUST be a mine.
If a '2' has only 2 hidden neighbors → both MUST be mines.
General: if number N has exactly N hidden neighbors, all are mines.

### Pattern: 1-1 on Edge
Two adjacent '1's on the edge with shared hidden cells: the mine is in the shared region.
\`\`\`
H H H    The mine must be in position shared by both 1s.
1 1 0    The H next to only the left 1 is SAFE.
\`\`\`

### Pattern: 1-2 on Edge
\`\`\`
H H H    '1' accounts for 1 mine, '2' needs 2. 
1 2 1    The outer H cells (near the 1s) are SAFE if 2's mines are in the middle.
\`\`\`

### Pattern: Corner Analysis
Corner numbers have fewer neighbors (3 instead of 8). A '1' in a corner with 2 hidden neighbors means one is safe if 1 is flagged.

## STRATEGY PRIORITY (follow this order)
1. **Certain safe cells**: Reveal cells adjacent to satisfied numbers (number = adjacent flags)
2. **Certain mines**: Flag cells where number = remaining hidden neighbors
3. **Chain deductions**: After revealing, new numbers give new info—reassess the board
4. **Probability guess**: When no certain moves exist, choose cells with lowest mine probability (prefer cells with more revealed number neighbors, corners/edges of unknown regions are riskier)

## COMMON MISTAKES TO AVOID
- Don't reveal cells adjacent to unsatisfied numbers without analysis
- Don't guess randomly—always look for deductions first
- Don't forget diagonal neighbors count too
- Count carefully: each number refers to ALL 8 directions

## EXAMPLE ANALYSIS
\`\`\`
   0 1 2 3
0: 0 1 H H
1: 0 1 H H
2: 0 0 1 1
\`\`\`
Analysis:
- The '1' at (0,1) has only (0,2) as hidden neighbor → (0,2) is a MINE
- The '1' at (1,1) has (0,2), (1,2) as hidden neighbors. If (0,2) is mined, (1,2) is SAFE
- The '1' at (2,2) touches (1,2), (1,3). If (1,2) is safe, check remaining constraints.
- The '1' at (2,3) touches (1,2), (1,3). Combined with (2,2), deduce which is safe.

## YOUR TASK
Analyze the board systematically. Find the SAFEST move using logical deduction.
When multiple safe moves exist, prefer revealing over flagging (reveals give more information).
Only flag when you're certain AND it helps deduce other cells.
Think step by step before choosing your move.`

      // IMPORTANT: You can submit multiple moves at once using makeMoves if you're confident they are safe.
      // This is faster than one move at a time. Batch obvious safe cells together (e.g., cells adjacent to 0s).
      // Use makeMove for single cautious moves, and makeMoves for batches of confident moves.

      const { toolResults } = await generateText({
        model: models[modelId],
        system: systemPrompt,
        prompt: `Current board:
${boardString}

Analyze the board:
1. Find all cells adjacent to satisfied numbers (safe to reveal)
2. Find all cells that must be mines (flag if helpful)
3. If no certain moves, identify lowest-risk cell

Make your move:`,
        toolChoice: 'required',
        tools: {
          makeMove: tool({
            description:
              'Make a move. Use "reveal" on cells you believe are safe. Use "flag" only on confirmed mines when it helps deduce other cells. Prefer revealing—it gives more information.',
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
              reasoning: z
                .string()
                .describe(
                  'Your deduction: which numbers did you analyze? Why is this cell safe/a mine?'
                )
                .optional(),
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
          endTime: Date.now(),
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
    endTime: outcome !== 'playing' ? Date.now() : undefined,
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
