export type GameOutcome = 'win' | 'loss' | 'stuck' | 'error' | 'playing'

export type CellState = {
  row: number
  col: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  adjacentMines: number // 0-8
}

export type BoardState = CellState[][]

// Compact visible board encoding (rows separated by \n)
export type CompactBoard = string

// Delta update for changed cells: [row, col, value]
export type CellDelta = [number, number, string | number]

export type GameResult = {
  modelId: string
  outcome: GameOutcome
  score: number
  moves: number
  durationMs: number
  safeRevealed: number
  totalSafe: number
  minesHit: 0 | 1
}

export type ReplayFrame = {
  boardState: BoardState
  move: {
    action: 'reveal' | 'flag'
    row: number
    col: number
  } | null
}

export type GameConfig = {
  rows: number
  cols: number
  mineCount: number
}

export type Difficulty = 'beginner' | 'intermediate' | 'expert'
