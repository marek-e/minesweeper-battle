"use client";

import { useReducer, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { BoardGrid } from "@/components/BoardGrid";
import { createBoard, revealCell, flagCell } from "@/lib/minesweeper";
import type { BoardState, GameConfig, GameOutcome } from "@/lib/types";
import { Flag, Eye, RefreshCw, X, Bomb, ChevronDown } from "lucide-react";

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
  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
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

  const handleNewGame = () => {
    dispatch({
      type: "NEW_GAME",
      payload: { config: DIFFICULTIES[difficulty] },
    });
    setTime(0);
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

  return (
    <div className="bg-slate-900 min-h-screen text-slate-50">
      <header className="flex items-center justify-between p-4 border-b border-slate-800">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <Bomb className="text-blue-500" />
          Minesweeper LLM Arena
        </Link>
        <button
          onClick={handleNewGame}
          className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          New Game
        </button>
      </header>

      <main className="p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
          {/* Left Column */}
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-6">Human Play Mode</h1>
            <div className="grid grid-cols-3 gap-4 mb-6 w-full max-w-md">
              <StatBox
                label="Time"
                value={new Date(time * 1000).toISOString().substr(14, 5)}
              />
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
          <aside className="w-full lg:w-64 space-y-6">
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
                <button
                  onClick={() => setActiveTool("reveal")}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    activeTool === "reveal"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  <Eye size={16} /> Reveal
                </button>
                <button
                  onClick={() => setActiveTool("flag")}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    activeTool === "flag"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  <Flag size={16} /> Flag
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={handleNewGame}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw size={16} /> Restart
                </button>
                <Link
                  href="/"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-900/50 hover:bg-red-900/80 text-red-300 transition-colors"
                >
                  <X size={16} /> Quit
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
