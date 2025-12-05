"use client";

import { useReducer, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { BoardGrid } from "@/components/BoardGrid";
import { Button } from "@/components/Button";
import { createBoard, revealCell, flagCell } from "@/lib/minesweeper";
import type { BoardState, GameConfig, GameOutcome } from "@/lib/types";
import {
  Flag,
  Eye,
  RefreshCw,
  X,
  Bomb,
  ChevronDown,
  Trophy,
} from "lucide-react";
import { Modal } from "@/components/Modal";

const DIFFICULTIES: Record<string, GameConfig> = {
  Easy: { rows: 9, cols: 9, mineCount: 10 },
  Medium: { rows: 16, cols: 16, mineCount: 40 },
  Hard: { rows: 16, cols: 30, mineCount: 99 },
};

type GameState = {
  board: BoardState | null;
  outcome: GameOutcome;
  moves: number;
  safeRevealed: number;
  flagsUsed: number;
  config: GameConfig;
};

type GameAction =
  | { type: "NEW_GAME"; payload: { config: GameConfig } }
  | { type: "REVEAL_CELL"; payload: { row: number; col: number } }
  | { type: "FLAG_CELL"; payload: { row: number; col: number } };

const createInitialState = (config: GameConfig): GameState => ({
  board: null,
  outcome: "playing",
  moves: 0,
  safeRevealed: 0,
  flagsUsed: 0,
  config,
});

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return createInitialState(action.payload.config);

    case "REVEAL_CELL": {
      if (state.outcome !== "playing") return state;
      const { row, col } = action.payload;
      let { board, safeRevealed, moves } = state;

      if (!board) {
        board = createBoard(state.config, { row, col });
      }

      const newBoard = JSON.parse(JSON.stringify(board));
      const cell = newBoard[row][col];
      if (cell.isRevealed || cell.isFlagged) return state;

      const { revealedCount, hitMine } = revealCell(newBoard, row, col);
      moves++;

      if (hitMine) {
        return { ...state, board: newBoard, outcome: "loss", moves };
      }

      safeRevealed += revealedCount;
      const totalSafeCells =
        state.config.rows * state.config.cols - state.config.mineCount;
      const newOutcome = safeRevealed === totalSafeCells ? "win" : "playing";

      return {
        ...state,
        board: newBoard,
        outcome: newOutcome,
        safeRevealed,
        moves,
      };
    }

    case "FLAG_CELL": {
      if (state.outcome !== "playing" || !state.board) return state;
      const { row, col } = action.payload;
      const newBoard = JSON.parse(JSON.stringify(state.board));
      const cell = newBoard[row][col];
      if (cell.isRevealed) return state;

      const flagsUsed = state.flagsUsed + (cell.isFlagged ? -1 : 1);
      flagCell(newBoard, row, col);

      return { ...state, board: newBoard, flagsUsed, moves: state.moves + 1 };
    }
    default:
      return state;
  }
}

const StatBox = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-left">
    <div className="text-sm text-slate-400 mb-1">{label}</div>
    <div className="text-3xl font-bold font-mono">{value}</div>
  </div>
);

export default function HumanPage() {
  const [difficulty, setDifficulty] = useState("Medium");
  const [state, dispatch] = useReducer(
    gameReducer,
    createInitialState(DIFFICULTIES[difficulty])
  );
  const [time, setTime] = useState(0);
  const [activeTool, setActiveTool] = useState<"reveal" | "flag">("reveal");
  const [modalDismissed, setModalDismissed] = useState(false);

  useEffect(() => {
    dispatch({
      type: "NEW_GAME",
      payload: { config: DIFFICULTIES[difficulty] },
    });
  }, [difficulty]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (state.outcome === "playing" && state.board) {
      timer = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [state.outcome, state.board]);

  // Derive modal from outcome - no effect needed
  const modal =
    !modalDismissed && state.outcome !== "playing" ? state.outcome : null;

  const handleNewGame = () => {
    dispatch({
      type: "NEW_GAME",
      payload: { config: DIFFICULTIES[difficulty] },
    });
    setTime(0);
    setModalDismissed(false);
  };

  const handleCellClick = (row: number, col: number) => {
    if (activeTool === "reveal") {
      dispatch({ type: "REVEAL_CELL", payload: { row, col } });
    } else {
      dispatch({ type: "FLAG_CELL", payload: { row, col } });
    }
  };

  const emptyBoard = useMemo(
    () => createBoard({ ...state.config, mineCount: 0 }),
    [state.config]
  );
  const displayBoard = state.board ?? emptyBoard;
  const formattedTime = new Date(time * 1000).toISOString().substr(14, 5);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-50">
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <Bomb className="text-blue-500" />
          Minesweeper LLM Arena
        </Link>
        <Button variant="primary" onClick={handleNewGame}>
          New Game
        </Button>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex w-full gap-8 justify-center">
          {/* Left Column */}
          <div className="flex flex-col items-start gap-8">
            <h1 className="text-[2rem] font-bold">Human Play Mode</h1>
            <div className="grid grid-cols-3 gap-4 w-full">
              <StatBox label="Time" value={formattedTime} />
              <StatBox
                label="Moves"
                value={String(state.moves).padStart(2, "0")}
              />
              <StatBox
                label="Mines Left"
                value={String(
                  state.config.mineCount - state.flagsUsed
                ).padStart(2, "0")}
              />
            </div>
            <div className="p-2 bg-slate-950/50 border border-slate-800 rounded-xl">
              <BoardGrid board={displayBoard} onCellClick={handleCellClick} />
            </div>
          </div>

          {/* Right Column (Sidebar) */}
          <aside className="w-full lg:w-64 flex flex-col gap-8">
            <div className="h-[48px]"></div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <label
                htmlFor="difficulty"
                className="block text-sm font-medium text-slate-400 mb-2"
              >
                Difficulty
              </label>
              <div className="relative">
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(DIFFICULTIES).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Controls
              </h3>
              <div className="space-y-2">
                <Button
                  fullWidth
                  active={activeTool === "reveal"}
                  onClick={() => setActiveTool("reveal")}
                >
                  <Eye size={16} /> Reveal
                </Button>
                <Button
                  fullWidth
                  active={activeTool === "flag"}
                  onClick={() => setActiveTool("flag")}
                >
                  <Flag size={16} /> Flag
                </Button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Actions
              </h3>
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
        title={modal === "win" ? "You Win!" : "Game Over"}
      >
        <div className="text-center">
          <div className="flex justify-center text-6xl mb-4">
            {modal === "win" ? (
              <Trophy className="text-yellow-400" />
            ) : (
              <Bomb className="text-red-500" />
            )}
          </div>
          <p className="text-slate-300 mb-6">
            {modal === "win"
              ? "Congratulations! You cleared the board."
              : "You hit a mine!"}
          </p>
          <div className="flex justify-center gap-4 text-slate-400 mb-8">
            <span>
              Time:{" "}
              <span className="font-bold text-white">{formattedTime}</span>
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
  );
}
