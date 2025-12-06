# AGENTS — Implementation Guide

This document defines the architecture, rules, and constraints for autonomous agents (LLMs or developers) modifying or extending the Minesweeper Battle codebase.

---

## Goal

Maintain a **stable, reproducible, deterministic** Minesweeper evaluation platform where LLM agents compete on identical hidden boards.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│  /setup → /arena (live SSE) → /replay/[id] (frame-by-frame)        │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    POST /api/battle (create)
                    GET /api/battle/[id]/stream (SSE)
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                   │
│  battleStore (in-memory) ←→ battleRunner (LLM loop) ←→ minesweeper │
│         ↓                                                           │
│     db.ts (Vercel KV / in-memory fallback)                         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    Vercel AI SDK + AI Gateway
                                │
┌─────────────────────────────────────────────────────────────────────┐
│                        LLM MODELS                                   │
│  GPT-5-mini │ Claude 3.7 Sonnet │ Gemini 2.5 Flash │ Grok Fast     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### `/lib/minesweeper.ts` — Game Engine

**Pure, deterministic functions. No side effects.**

| Function | Purpose |
|----------|---------|
| `generateMinePositions(config, seed, excludedCell?)` | Seeded PRNG mine placement |
| `createBoard(config, firstClick?, minePositions?)` | Initialize board state |
| `revealCell(board, row, col)` | Reveal + flood-fill, returns `{ revealedCount, hitMine }` |
| `flagCell(board, row, col)` | Toggle flag |
| `getVisibleBoard(board)` | Convert to visible `(string\|number)[][]` |
| `encodeBoard(board)` | Compact string for SSE |
| `decodeBoard(encoded, rows, cols)` | Reconstruct visible board |
| `encodeBoardForLLM(board)` | Labeled format with row/col headers |

**Rules:**
- Never add randomness without a seed parameter
- All mutations must be in-place on the `BoardState` object
- Flood-fill must be BFS, not recursive (stack safety)

### `/lib/battleRunner.ts` — LLM Orchestration

**Manages the LLM game loop.**

| Component | Description |
|-----------|-------------|
| `runModelSimulation()` | Single model's game loop |
| `runBattle()` | Parallel execution of all models |
| Tools: `makeMove`, `makeMoves` | Vercel AI SDK tool definitions |

**Constants:**
- `MAX_MOVES = 60` — prevent infinite loops
- `MAX_RETRIES = 3` — per-move retry limit

**Flow:**
1. Send system prompt + visible board to model
2. Model calls `makeMove` or `makeMoves` tool
3. Execute move(s), update board, emit SSE event
4. Check win/loss/stuck condition
5. Repeat until game ends

### `/lib/battleStore.ts` — State Management

**In-memory event-sourced state.**

| Type | Purpose |
|------|---------|
| `BattleState` | Full battle state including all model states |
| `ModelState` | Per-model board, status, stats |
| `BattleEvent` | `init`, `move`, `complete`, `done` events |

**Methods:**
- `createBattle()` — Initialize battle, persist to DB
- `subscribe()` — SSE subscription
- `emit()` — Broadcast event to subscribers + persist frame

### `/lib/db.ts` — Persistence Layer

**Vercel KV with in-memory fallback.**

| Function | Purpose |
|----------|---------|
| `insertBattle()` | Create battle metadata |
| `insertFrame()` | Store frame for replay |
| `insertResult()` | Store final result per model |
| `updateBattleCompletion()` | Mark battle complete |
| `getCompletedBattle()` | Fetch battle + all frames |
| `listBattles()` | Paginated list |

**Storage Schema:**
```
battle:{id}              → BattleMetadata
battle:{id}:frames:{model} → BattleFrame[]
battle:{id}:results      → Record<model, GameResult>
battles:completed        → Sorted set (score = timestamp)
```

### `/lib/scoring.ts` — Scoring Algorithm

```typescript
if (outcome === 'win') {
  score = 100 * (safeRevealed / totalSafe) - 0.5 * (moves - 1)
} else {
  score = 100 * (safeRevealed / totalSafe) - 50 * minesHit
}
return Math.max(0, Math.round(score))
```

**Do not modify** the scoring formula without updating README.md.

---

## Type System

### Core Types (`/lib/types.ts`)

```typescript
type CellState = {
  row: number
  col: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  adjacentMines: number // 0-8
}

type BoardState = CellState[][]

type GameOutcome = 'win' | 'loss' | 'stuck' | 'error' | 'playing'

type GameResult = {
  modelId: string
  outcome: GameOutcome
  score: number
  moves: number
  durationMs: number
  safeRevealed: number
  totalSafe: number
  minesHit: 0 | 1
}

type GameConfig = {
  rows: number
  cols: number
  mineCount: number
}
```

---

## SSE Event Protocol

### Event Types

| Event | Payload | When |
|-------|---------|------|
| `init` | `{ config, models }` | Battle starts |
| `move` | `{ modelId, action, row, col, board, delta? }` | After each move |
| `complete` | `{ modelId, outcome, moves, safeRevealed, minesHit, durationMs }` | Model finishes |
| `done` | `{ rankings }` | All models finished |

### Board Encoding in `move` Event

- `board`: Compact string (rows separated by `\n`)
- `delta`: Optional `[row, col, value][]` for changed cells only

---

## LLM Tool Interface

### `makeMove` — Single Move

```typescript
{
  action: 'reveal' | 'flag',
  row: number,        // 0 to rows-1
  col: number,        // 0 to cols-1
  reasoning?: string  // Optional explanation
}
```

### `makeMoves` — Batch Moves

```typescript
{
  moves: Array<{ action, row, col }>,  // 1-20 moves
  reasoning?: string
}
```

**Batch behavior:**
- Executes sequentially
- Stops on first mine hit or invalid move
- Returns `{ success, executed, total, stoppedEarly }`

---

## Constraints & Invariants

### Must Preserve

1. **Determinism** — Same seed + same moves = same outcome
2. **Fair comparison** — All models see identical initial boards
3. **Type safety** — No `any` types in core logic
4. **SSE compatibility** — Event format is consumed by frontend

### Board Constraints

```typescript
const MAX_ROWS = 30
const MAX_COLS = 30
const MAX_MINES = 200
```

### Model Constraints

Models must be in `AUTHORIZED_MODELS` array:
```typescript
const AUTHORIZED_MODELS = [
  'gpt-5-mini',
  'gemini-2.5-flash',
  'claude-3.7-sonnet',
  'grok-code-fast-1',
]
```

To add a new model:
1. Add to `AUTHORIZED_MODELS` in `/lib/battleConfig.ts`
2. Add model mapping in `/lib/battleRunner.ts` `models` record

---

## Common Operations

### Adding a New Model

```typescript
// 1. /lib/battleConfig.ts
export const AUTHORIZED_MODELS = [
  ...existing,
  'new-model-id',
] as const

// 2. /lib/battleRunner.ts
const models: Record<AuthorizedModel, LanguageModel> = {
  ...existing,
  'new-model-id': 'provider/model-name',
}

// 3. /app/setup/page.tsx (optional: add display name)
const MODEL_NAMES: Record<AuthorizedModel, string> = {
  ...existing,
  'new-model-id': 'New Model Display Name',
}
```

### Modifying Scoring

1. Update formula in `/lib/scoring.ts`
2. Update documentation in `README.md`
3. Ensure backwards compatibility (old battles keep old scores)

### Adding New SSE Event

1. Add type to `BattleEvent` union in `/lib/battleStore.ts`
2. Add payload transformer in `/api/battle/[battleId]/stream/route.ts`
3. Handle in `/app/arena/page.tsx` and `/app/replay/[battleId]/page.tsx`

---

## Testing Considerations

- Game logic can be unit tested with known seeds
- Use `generateMinePositions()` with fixed seed for reproducible boards
- SSE events can be mocked for frontend testing

---

## File Dependency Graph

```
types.ts ─────────────────────────────────────────────┐
    │                                                  │
    ├── minesweeper.ts (pure game logic)              │
    │        │                                         │
    │        └── battleRunner.ts (LLM orchestration)  │
    │                 │                                │
    │                 ├── battleStore.ts (state)      │
    │                 │        │                       │
    │                 │        └── db.ts (persistence)│
    │                 │                                │
    │                 └── scoring.ts                  │
    │                                                  │
    └── components/* (React components) ──────────────┘
```

---

## Error Handling

| Scenario | Outcome |
|----------|---------|
| Invalid JSON from LLM | Retry (up to 3) |
| Invalid move (already revealed, out of bounds) | Retry |
| 3 consecutive failures | `outcome: "error"` |
| 60 moves reached | `outcome: "stuck"` |
| LLM returns no tool call | `outcome: "stuck"` |

---

## Performance Notes

- Boards are deep-cloned (`JSON.parse(JSON.stringify())`) for state snapshots
- SSE uses delta encoding when possible to reduce payload size
- Batch moves (`makeMoves`) significantly reduce API round-trips
- In-memory store is ephemeral; Vercel KV provides persistence

---

## Security Notes

- Model IDs are validated against `AUTHORIZED_MODELS`
- Board config is validated with Zod schema
- No user-provided code is executed
- API keys are server-side only
