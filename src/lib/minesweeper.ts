import type { BoardState, GameConfig } from './types'

/**
 * Creates a new Minesweeper board.
 * @param config - The game configuration: rows, cols, and mineCount.
 * @param firstClick - Optional: The first cell clicked, to ensure it's not a mine.
 * @returns The initial board state.
 */
export function createBoard(
  config: GameConfig,
  firstClick?: { row: number; col: number }
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
