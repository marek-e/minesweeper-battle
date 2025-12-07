# Minesweeper Battle

AI Gateway Hackathon project — LLMs compete to solve Minesweeper on the **same hidden board**.

Each model is an autonomous agent that receives the visible board state and chooses cells to reveal. The backend simulates the game deterministically, and the UI replays all model runs side-by-side for comparison.

Deployed on Vercel, powered by **AI Gateway** + **Vercel AI SDK**.

---

## How It Works

### Battle Flow

1. **Setup** — User configures board (rows × cols × mines) and selects LLM models.
2. **Battle Creation** — Backend generates a seeded board and starts all models in parallel.
3. **LLM Loop** — Each model receives the visible board, returns a JSON move via tool calling, backend applies the move, repeat until game ends.
4. **Real-time Streaming** — SSE pushes each move to the frontend for live viewing.
5. **Replay** — All frames are persisted; users can replay any battle frame-by-frame.

### Same Board Guarantee

All models play on the **exact same hidden board** generated from a shared `boardSeed`. This ensures fair comparison — differences in outcome are due to model strategy, not luck.

### Game Rules (for models)

- Board shows: `H` (hidden), `F` (flagged), `0-8` (revealed count of adjacent mines).
- Each turn, the model calls one of two tools:
  - `makeMove({ action, row, col })` — single cautious move
  - `makeMoves({ moves: [...] })` — batch of confident moves (faster)
- `reveal` on a safe cell → shows number (flood-fills if 0)
- `reveal` on a mine → **loss**
- `flag` toggles flag without revealing
- Game ends when: all safe cells revealed (**win**), mine hit (**loss**), model stuck/errors (**stuck/error**)

### Example Move (LLM output)

```json
{
  "action": "reveal",
  "row": 3,
  "col": 5,
  "reasoning": "Cell at (3,5) is adjacent to a 0, so it must be safe."
}
```

---

## Scoring & Ranking

### Per-Model Score

```
if outcome === "win":
  score = 100 * (safeRevealed / totalSafe) - 0.5 * (moves - 1)
else:
  score = 100 * (safeRevealed / totalSafe) - 50 * minesHit
```

### Ranking Tiebreakers

1. Score (descending)
2. Outcome priority: `win > stuck > loss > error`
3. Moves (ascending — fewer is better)
4. Duration (ascending — faster is better)

### Key Metrics

| Metric         | Description                          |
| -------------- | ------------------------------------ |
| `safeRevealed` | Non-mine cells successfully revealed |
| `totalSafe`    | Total non-mine cells on board        |
| `minesHit`     | 0 or 1                               |
| `moves`        | Total moves made                     |
| `outcome`      | `win`, `loss`, `stuck`, `error`      |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/
│   │   ├── battle/         # POST: create battle, GET: SSE stream
│   │   └── battles/        # GET: list/get battles
│   ├── arena/              # Live battle viewing
│   ├── history/            # Past battles list
│   ├── human/              # Human play mode
│   ├── replay/[battleId]/  # Frame-by-frame replay
│   └── setup/              # Game configuration
├── components/
│   ├── BoardGrid.tsx       # Grid renderer
│   ├── Cell.tsx            # Individual cell
│   ├── PlaybackControls.tsx
│   ├── ReplayPlayer.tsx
│   ├── RankingTable.tsx
│   └── ui/                 # Button, Modal
├── hooks/
│   ├── useBattle.ts        # Fetch single battle
│   └── useBattles.ts       # Fetch battle list
└── lib/
    ├── minesweeper.ts      # Core game logic
    ├── battleRunner.ts     # LLM orchestration
    ├── battleStore.ts      # In-memory state + events
    ├── db.ts               # Persistence (KV or in-memory)
    ├── scoring.ts          # Score calculation
    ├── types.ts            # TypeScript types
    ├── sse.ts              # Server-Sent Events helpers
    └── api.ts              # Client-side API calls
```

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **AI**: Vercel AI SDK with tool calling, AI Gateway
- **State**: In-memory store + Vercel KV for persistence
- **Real-time**: Server-Sent Events (SSE)
- **Deployment**: Vercel

---

## API Reference

### `POST /api/battle`

Create a new battle.

**Request:**

```json
{
  "rows": 9,
  "cols": 9,
  "mineCount": 10,
  "models": ["gpt-5-mini", "claude-3.7-sonnet"]
}
```

**Response:**

```json
{
  "battleId": "battle_1733500000000_abc123"
}
```

### `GET /api/battle/[battleId]/stream`

SSE stream of battle events.

**Events:**

- `init` — `{ config, models }`
- `move` — `{ modelId, action, row, col, board, delta }`
- `complete` — `{ modelId, outcome, moves, safeRevealed, minesHit, durationMs }`
- `done` — `{ rankings: [...] }`

### `GET /api/battles`

List completed battles with pagination.

### `GET /api/battles/[battleId]`

Get full battle data including frames for replay.

---

## Authorized Models

```typescript
const AUTHORIZED_MODELS = [
  'gpt-5-mini',
  'gemini-2.5-flash',
  'claude-3.7-sonnet',
  'grok-code-fast-1',
]
```

---

## Board Encoding

### For LLMs (with labels)

```
  0123456789
0 HHHHHHHHHH
1 HH00000HHH
2 H0012210HH
3 H001HH21HH
```

### Compact (for SSE)

```
HHHHHHHHHH
HH00000HHH
H0012210HH
H001HH21HH
```

- `H` = Hidden
- `F` = Flagged
- `0-8` = Revealed (adjacent mine count)
- `M` = Revealed mine (game over)

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
pnpm install
```

### Environment Variables

```env
# Optional - uses in-memory storage without these
UPSTASH_REDIS_REST_URL=your-upstash-redis-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token

# AI Gateway
AI_GATEWAY_API_KEY=...
# Or Model API keys
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
XAI_API_KEY=...
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Key Concepts

### Deterministic Boards

Boards are generated using a seeded PRNG (mulberry32). Same seed = same mine positions. The first click is always safe (mines excluded from 3×3 area around first click).

### Flood Fill

When revealing a cell with 0 adjacent mines, all connected 0-cells and their borders are auto-revealed (standard Minesweeper behavior).

### Batch Moves

Models can submit up to 20 moves at once via `makeMoves`. Execution stops early if a mine is hit. This dramatically speeds up confident play.

### Retries

Models get up to 3 retries per move on failure. After 3 consecutive failures → `outcome: "error"`.

### Max Moves

Games are capped at 60 moves to prevent infinite loops.

---

## Human Play Mode

Visit `/human` to play Minesweeper yourself. Features:

- Three difficulties: Easy (9×9, 10 mines), Medium (16×16, 40), Hard (16×30, 99)
- Timer, move counter, mine counter
- Toggle between Reveal and Flag modes
- Win/loss modal with stats

---

## License

MIT
