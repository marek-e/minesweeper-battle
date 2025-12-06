import type { BoardState, GameConfig } from './types'

/**
 * Simple seeded random number generator (mulberry32)
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates mine positions deterministically based on a seed.
 * @param config - The game configuration
 * @param seed - Random seed for deterministic generation
 * @param excludedCell - Optional cell to exclude from mine placement (first click)
 * @returns Array of [row, col] mine positions
 */
export function generateMinePositions(
  config: GameConfig,
  seed: number,
  excludedCell?: { row: number; col: number }
): [number, number][] {
  const { rows, cols, mineCount } = config
  const random = seededRandom(seed)

  // Create all possible positions
  const allPositions: [number, number][] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Exclude the first click cell and its neighbors
      if (excludedCell) {
        const rowDiff = Math.abs(row - excludedCell.row)
        const colDiff = Math.abs(col - excludedCell.col)
        if (rowDiff <= 1 && colDiff <= 1) continue
      }
      allPositions.push([row, col])
    }
  }

  // Shuffle using Fisher-Yates with seeded random
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]]
  }

  // Take first mineCount positions
  return allPositions.slice(0, mineCount)
}

/**
 * Creates a new Minesweeper board.
 * @param config - The game configuration: rows, cols, and mineCount.
 * @param firstClick - Optional: The first cell clicked, to ensure it's not a mine.
 * @param minePositions - Optional: Pre-defined mine positions for deterministic boards.
 * @returns The initial board state.
 */
export function createBoard(
  config: GameConfig,
  firstClick?: { row: number; col: number },
  minePositions?: [number, number][]
): BoardState {
  const { rows, cols, mineCount } = config
  const board: BoardState = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    }))
  )

  // Use pre-defined mine positions if provided
  if (minePositions) {
    for (const [row, col] of minePositions) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        board[row][col].isMine = true
      }
    }
  } else {
    // Place mines randomly, avoiding the first click location
    let minesPlaced = 0
    const excludedIndex = firstClick ? firstClick.row * cols + firstClick.col : -1

    while (minesPlaced < mineCount) {
      const rowIndex = Math.floor(Math.random() * rows)
      const colIndex = Math.floor(Math.random() * cols)
      const cellIndex = rowIndex * cols + colIndex

      if (!board[rowIndex][colIndex].isMine && cellIndex !== excludedIndex) {
        board[rowIndex][colIndex].isMine = true
        minesPlaced++
      }
    }
  }

  // Calculate adjacent mines for each cell
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (board[row][col].isMine) continue
      let count = 0
      for (let r_offset = -1; r_offset <= 1; r_offset++) {
        for (let c_offset = -1; c_offset <= 1; c_offset++) {
          if (r_offset === 0 && c_offset === 0) continue
          const newRow = row + r_offset
          const newCol = col + c_offset
          if (
            newRow >= 0 &&
            newRow < rows &&
            newCol >= 0 &&
            newCol < cols &&
            board[newRow][newCol].isMine
          ) {
            count++
          }
        }
      }
      board[row][col].adjacentMines = count
    }
  }

  return board
}

/**
 * Reveals a cell and performs flood-fill if it's a zero-area.
 * @param board - The current board state.
 * @param row - The row of the cell to reveal.
 * @param col - The column of the cell to reveal.
 * @returns The number of cells revealed in this move.
 */
export function revealCell(
  board: BoardState,
  row: number,
  col: number
): { revealedCount: number; hitMine: boolean } {
  const cell = board[row][col]

  if (cell.isRevealed || cell.isFlagged) {
    return { revealedCount: 0, hitMine: false }
  }

  if (cell.isMine) {
    cell.isRevealed = true
    return { revealedCount: 1, hitMine: true }
  }

  let revealedCount = 0
  const queue: [number, number][] = [[row, col]]
  const visited = new Set<string>()
  visited.add(`${row},${col}`)

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    const currentCell = board[r][c]

    if (currentCell.isRevealed) continue

    currentCell.isRevealed = true
    revealedCount++

    if (currentCell.adjacentMines === 0) {
      // Flood-fill to neighbors
      for (let r_offset = -1; r_offset <= 1; r_offset++) {
        for (let c_offset = -1; c_offset <= 1; c_offset++) {
          if (r_offset === 0 && c_offset === 0) continue
          const newRow = r + r_offset
          const newCol = c + c_offset

          if (
            newRow >= 0 &&
            newRow < board.length &&
            newCol >= 0 &&
            newCol < board[0].length &&
            !visited.has(`${newRow},${newCol}`)
          ) {
            visited.add(`${newRow},${newCol}`)
            queue.push([newRow, newCol])
          }
        }
      }
    }
  }

  return { revealedCount, hitMine: false }
}

/**
 * Toggles a flag on a cell.
 * @param board - The current board state.
 * @param row - The row of the cell to flag.
 * @param col - The column of the cell to flag.
 */
export function flagCell(board: BoardState, row: number, col: number): void {
  const cell = board[row][col]
  if (!cell.isRevealed) {
    cell.isFlagged = !cell.isFlagged
  }
}

/**
 * Creates a "visible" version of the board to send to an LLM.
 * 'H' = Hidden, 'F' = Flagged, 0-8 = Revealed number.
 * @param board - The current board state.
 * @returns A 2D array of strings representing the visible board.
 */
export function getVisibleBoard(board: BoardState): (string | number)[][] {
  return board.map((row) =>
    row.map((cell) => {
      if (cell.isRevealed) {
        return cell.adjacentMines
      }
      if (cell.isFlagged) {
        return 'F'
      }
      return 'H'
    })
  )
}

/**
 * Encodes board state as a compact string for SSE transmission.
 * Format: rows separated by \n, each row is a string of single chars.
 * 'H' = Hidden, 'F' = Flagged, '0'-'8' = Revealed number.
 * @param board - The current board state.
 * @returns Compact string representation.
 */
export function encodeBoard(board: BoardState): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell.isRevealed) {
            if (cell.isMine) return 'M'
            return String(cell.adjacentMines)
          }
          if (cell.isFlagged) {
            return 'F'
          }
          return 'H'
        })
        .join('')
    )
    .join('\n')
}

/**
 * Decodes a compact board string back to a visible board representation.
 * @param encoded - Compact string representation (rows separated by \n).
 * @param rows - Number of rows in the board.
 * @param cols - Number of columns in the board.
 * @returns 2D array of visible cell values.
 */
export function decodeBoard(encoded: string, rows: number, cols: number): (string | number)[][] {
  const lines = encoded.split('\n')
  const result: (string | number)[][] = []

  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const line = lines[rowIdx] || ''
    const rowData: (string | number)[] = []
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const char = line[colIdx] || 'H'
      if (char === 'M') {
        rowData.push('M')
      } else if (char === 'F') {
        rowData.push('F')
      } else if (char >= '0' && char <= '8') {
        rowData.push(Number(char))
      } else {
        rowData.push('H')
      }
    }
    result.push(rowData)
  }

  return result
}

/**
 * Computes delta between two board states (changed cells only).
 * @param prev - Previous board state (null for initial state).
 * @param curr - Current board state.
 * @returns Array of [row, col, value] tuples for changed cells.
 */
export function getDelta(
  prev: BoardState | null,
  curr: BoardState
): Array<[number, number, string | number]> {
  const delta: Array<[number, number, string | number]> = []

  for (let row = 0; row < curr.length; row++) {
    for (let col = 0; col < curr[row].length; col++) {
      const currCell = curr[row][col]
      const prevCell = prev?.[row]?.[col]

      // Get current visible value
      let currValue: string | number
      if (currCell.isRevealed) {
        currValue = currCell.adjacentMines
      } else if (currCell.isFlagged) {
        currValue = 'F'
      } else {
        currValue = 'H'
      }

      // Get previous visible value
      let prevValue: string | number
      if (prevCell) {
        if (prevCell.isRevealed) {
          prevValue = prevCell.adjacentMines
        } else if (prevCell.isFlagged) {
          prevValue = 'F'
        } else {
          prevValue = 'H'
        }
      } else {
        prevValue = 'H' // Assume hidden if no previous state
      }

      // Only include if changed
      if (currValue !== prevValue) {
        delta.push([row, col, currValue])
      }
    }
  }

  return delta
}

/**
 * Formats board for LLM prompt with row/column labels.
 * Format: Column header row, then numbered rows with single-char cells.
 * 'H' = Hidden, 'F' = Flagged, 0-8 = Revealed number.
 * @param board - The current board state.
 * @returns Formatted string with labels.
 */
export function encodeBoardForLLM(board: BoardState): string {
  const visible = getVisibleBoard(board)
  const cols = board[0]?.length || 0

  // Column header
  const header = '  ' + Array.from({ length: cols }, (_, i) => i).join('')

  // Numbered rows
  const rowsFormatted = visible.map((row, idx) => `${idx}${row.join('')}`)

  return [header, ...rowsFormatted].join('\n')
}
