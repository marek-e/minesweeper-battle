// src/app/actions.ts
'use server';

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import {
  createBoard,
  flagCell,
  getVisibleBoard,
  revealCell,
} from '@/lib/minesweeper';
import type {
  BoardState,
  GameConfig,
  GameOutcome,
  ReplayFrame,
} from '@/lib/types';

// For Vercel AI Gateway, the baseURL is set to the gateway endpoint.
// The API key is automatically forwarded by Vercel deployments.
// For local development, you must set the OPENAI_API_KEY environment variable.
const openai = createOpenAI({
  baseURL: 'https://gateway.vercel.ai/v1',
});

const MAX_MOVES = 60; // Hard cap for moves per game
const MAX_RETRIES = 3; // Retries for invalid LLM output

// Function to format the board state into a simple string for the prompt
function formatBoardForLLM(board: (string | number)[][]): string {
  return board
    .map(row => row.map(cell => String(cell).padStart(2, ' ')).join(' '))
    .join('\n');
}

export async function runSimulation(
  modelId: string,
  config: GameConfig
): Promise<{
  result: {
    modelId: string;
    outcome: GameOutcome;
    moves: number;
    durationMs: number;
    safeRevealed: number;
  };
  replayLog: ReplayFrame[];
}> {
  const startTime = Date.now();
  let board: BoardState | null = null;
  let moves = 0;
  let safeRevealed = 0;
  let outcome: GameOutcome = 'playing';
  let minesHit: 0 | 1 = 0;
  const replayLog: ReplayFrame[] = [];

  const totalSafeCells = config.rows * config.cols - config.mineCount;

  // --- Simulation Loop ---
  while (outcome === 'playing' && moves < MAX_MOVES) {
    let retries = 0;
    let moveSuccessful = false;

    while (retries < MAX_RETRIES && !moveSuccessful) {
      try {
        const visibleBoard = board ? getVisibleBoard(board) : null;
        const boardString = visibleBoard
          ? formatBoardForLLM(visibleBoard)
          : 'The board is empty. Make your first move.';

        const systemPrompt = `
You are a Minesweeper player. Your goal is to win by revealing all safe cells.
The board is a ${config.rows}x${config.cols} grid with ${config.mineCount} hidden mines.
You will be given the current board state and must return your next move in JSON format.
'H' means a hidden cell. 'F' means a flagged cell. A number (0-8) means a revealed cell showing adjacent mines.
Rows and columns are 0-indexed. Your move must be on a hidden, unflagged cell.
Choose your action and coordinates carefully based on the visible numbers.
`;

        const { toolResults } = await generateText({
          model: openai(modelId),
          system: systemPrompt,
          prompt: `Current board:\n${boardString}\n\nWhat is your next move?`,
          tools: {
            makeMove: tool({
              description: 'Make a move by revealing or flagging a cell.',
              parameters: z.object({
                action: z.enum(['reveal', 'flag']),
                row: z.number().int().min(0).max(config.rows - 1),
                col: z.number().int().min(0).max(config.cols - 1),
                reasoning: z.string().describe('A short explanation for your move.').optional(),
              }),
              execute: async ({ action, row, col }) => {
                // --- Board Initialization on First Move ---
                if (!board) {
                  board = createBoard(config, { row, col });
                  // Log initial empty state
                  replayLog.push({
                    boardState: createBoard({ ...config, mineCount: 0 }), // Show an empty board initially
                    move: null,
                  });
                }

                const cell = board[row][col];
                if (cell.isRevealed || (action === 'reveal' && cell.isFlagged)) {
                  throw new Error('Invalid move: Cell is not available.');
                }

                // --- Apply Move ---
                if (action === 'reveal') {
                  const { revealedCount, hitMine } = revealCell(board, row, col);
                  if (hitMine) {
                    outcome = 'loss';
                    minesHit = 1;
                  }
                  safeRevealed += revealedCount - (hitMine ? 1 : 0);
                } else if (action === 'flag') {
                  flagCell(board, row, col);
                }

                moves++;
                moveSuccessful = true;

                // Log the state *after* the move
                replayLog.push({
                  boardState: JSON.parse(JSON.stringify(board)), // Deep copy
                  move: { action, row, col },
                });

                return { success: true, row, col };
              },
            }),
          },
        });

        // This part runs after the tool execution
        if (!toolResults || toolResults.length === 0) {
          throw new Error('No move was made.');
        }

      } catch (error) {
        console.error(`[${modelId}] Error on move ${moves + 1}, retry ${retries + 1}:`, error);
        retries++;
        if (retries >= MAX_RETRIES) {
          outcome = 'error';
        }
      }
    }

    if (!moveSuccessful) {
      // If all retries failed, break the loop
      if (outcome !== 'error') outcome = 'stuck';
      break;
    }

    // --- Check Win/Loss Condition ---
    if (safeRevealed === totalSafeCells) {
      outcome = 'win';
    }
  }
  // --- End of Simulation Loop ---

  if (outcome === 'playing') {
    // If loop finished due to max moves
    outcome = 'stuck';
  }

  const durationMs = Date.now() - startTime;

  return {
    result: {
      modelId,
      outcome,
      moves,
      durationMs,
      safeRevealed,
      minesHit,
    },
    replayLog,
  };
}
