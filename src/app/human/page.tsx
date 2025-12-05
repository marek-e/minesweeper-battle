'use client'

import { useReducer, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { BoardGrid } from '@/components/BoardGrid'
import { Button } from '@/components/ui/Button'
import { createBoard, revealCell, flagCell } from '@/lib/minesweeper'
import type { BoardState, GameConfig, GameOutcome } from '@/lib/types'
import { Flag, Eye, RefreshCw, X, Bomb, ChevronDown, Trophy } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

const DIFFICULTIES: Record<string, GameConfig> = {
  Easy: { rows: 9, cols: 9, mineCount: 10 },
  Medium: { rows: 16, cols: 16, mineCount: 40 },
  Hard: { rows: 16, cols: 30, mineCount: 99 },
}

type GameState = {
  board: BoardState | null
  outcome: GameOutcome
  moves: number
  safeRevealed: number
  flagsUsed: number
  config: GameConfig
}

type GameAction =
  | { type: 'NEW_GAME'; payload: { config: GameConfig } }
  | { type: 'REVEAL_CELL'; payload: { row: number; col: number } }
  | { type: 'FLAG_CELL'; payload: { row: number; col: number } }

const createInitialState = (config: GameConfig): GameState => ({
  board: null,
  outcome: 'playing',
  moves: 0,
  safeRevealed: 0,
  flagsUsed: 0,
  config,
})

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createInitialState(action.payload.config)

    case 'REVEAL_CELL': {
      if (state.outcome !== 'playing') return state
      const { row, col } = action.payload
      let { board, safeRevealed, moves } = state

      if (!board) {
        board = createBoard(state.config, { row, col })
      }

      const newBoard = JSON.parse(JSON.stringify(board))
      const cell = newBoard[row][col]
      if (cell.isRevealed || cell.isFlagged) return state

      const { revealedCount, hitMine } = revealCell(newBoard, row, col)
      moves++

      if (hitMine) {
        return { ...state, board: newBoard, outcome: 'loss', moves }
      }

      safeRevealed += revealedCount
      const totalSafeCells = state.config.rows * state.config.cols - state.config.mineCount
      const newOutcome = safeRevealed === totalSafeCells ? 'win' : 'playing'

      return {
        ...state,
        board: newBoard,
        outcome: newOutcome,
        safeRevealed,
        moves,
      }
    }

    case 'FLAG_CELL': {
      if (state.outcome !== 'playing' || !state.board) return state
      const { row, col } = action.payload
      const newBoard = JSON.parse(JSON.stringify(state.board))
      const cell = newBoard[row][col]
      if (cell.isRevealed) return state

      const flagsUsed = state.flagsUsed + (cell.isFlagged ? -1 : 1)
      flagCell(newBoard, row, col)

      return { ...state, board: newBoard, flagsUsed, moves: state.moves + 1 }
    }
    default:
      return state
  }
}

const StatBox = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left">
    <div className="mb-1 text-sm text-slate-400">{label}</div>
    <div className="font-mono text-3xl font-bold">{value}</div>
  </div>
)

export default function HumanPage() {
  const [difficulty, setDifficulty] = useState('Medium')
  const [state, dispatch] = useReducer(gameReducer, createInitialState(DIFFICULTIES[difficulty]))
  const [time, setTime] = useState(0)
  const [activeTool, setActiveTool] = useState<'reveal' | 'flag'>('reveal')
  const [modalDismissed, setModalDismissed] = useState(false)

  useEffect(() => {
    dispatch({
      type: 'NEW_GAME',
      payload: { config: DIFFICULTIES[difficulty] },
    })
  }, [difficulty])

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (state.outcome === 'playing' && state.board) {
      timer = setInterval(() => setTime((t) => t + 1), 1000)
    }
    return () => clearInterval(timer)
  }, [state.outcome, state.board])

  // Derive modal from outcome - no effect needed
  const modal = !modalDismissed && state.outcome !== 'playing' ? state.outcome : null

  const handleNewGame = () => {
    dispatch({
      type: 'NEW_GAME',
      payload: { config: DIFFICULTIES[difficulty] },
    })
    setTime(0)
    setModalDismissed(false)
  }

  const handleCellClick = (row: number, col: number) => {
    if (activeTool === 'reveal') {
      dispatch({ type: 'REVEAL_CELL', payload: { row, col } })
    } else {
      dispatch({ type: 'FLAG_CELL', payload: { row, col } })
    }
  }

  const emptyBoard = useMemo(() => createBoard({ ...state.config, mineCount: 0 }), [state.config])
  const displayBoard = state.board ?? emptyBoard
  const formattedTime = new Date(time * 1000).toISOString().substr(14, 5)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Bomb className="text-blue-500" />
          Minesweeper LLM Arena
        </Link>
        <Button variant="primary" onClick={handleNewGame}>
          New Game
        </Button>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="flex w-full justify-center gap-8">
          {/* Left Column */}
          <div className="flex flex-col items-start gap-8">
            <h1 className="text-[2rem] font-bold">Human Play Mode</h1>
            <div className="grid w-full grid-cols-3 gap-4">
              <StatBox label="Time" value={formattedTime} />
              <StatBox label="Moves" value={String(state.moves).padStart(2, '0')} />
              <StatBox
                label="Mines Left"
                value={String(state.config.mineCount - state.flagsUsed).padStart(2, '0')}
              />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
              <BoardGrid board={displayBoard} onCellClick={handleCellClick} />
            </div>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="flex w-full flex-col gap-8 lg:w-64">
            <div className="h-[48px]"></div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <label htmlFor="difficulty" className="mb-2 block text-sm font-medium text-slate-400">
                Difficulty
              </label>
              <div className="relative">
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full appearance-none rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {Object.keys(DIFFICULTIES).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-400">Controls</h3>
              <div className="space-y-2">
                <Button
                  fullWidth
                  active={activeTool === 'reveal'}
                  onClick={() => setActiveTool('reveal')}
                >
                  <Eye size={16} /> Reveal
                </Button>
                <Button
                  fullWidth
                  active={activeTool === 'flag'}
                  onClick={() => setActiveTool('flag')}
                >
                  <Flag size={16} /> Flag
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-400">Actions</h3>
              <div className="space-y-2">
                <Button fullWidth onClick={handleNewGame}>
                  <RefreshCw size={16} /> Restart
                </Button>
                <Button fullWidth variant="danger" href="/">
                  <X size={16} /> Quit
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Modal
        isOpen={modal !== null}
        onClose={() => setModalDismissed(true)}
        title={modal === 'win' ? 'You Win!' : 'Game Over'}
      >
        <div className="text-center">
          <div className="mb-4 flex justify-center text-6xl">
            {modal === 'win' ? (
              <Trophy className="text-yellow-400" />
            ) : (
              <Bomb className="text-red-500" />
            )}
          </div>
          <p className="mb-6 text-slate-300">
            {modal === 'win' ? 'Congratulations! You cleared the board.' : 'You hit a mine!'}
          </p>
          <div className="mb-8 flex justify-center gap-4 text-slate-400">
            <span>
              Time: <span className="font-bold text-white">{formattedTime}</span>
            </span>
            <span>
              Moves: <span className="font-bold text-white">{state.moves}</span>
            </span>
          </div>
          <div className="flex justify-center gap-4">
            <Button variant="secondary" href="/">
              Quit
            </Button>
            <Button variant="primary" onClick={handleNewGame}>
              Play Again
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
