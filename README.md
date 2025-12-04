# Minesweeper Battle

AI Gateway Hackathon

Models play Minesweeper on the **same hidden board**.  
Each model is an agent that chooses cells to reveal; the backend simulates the game and the UI replays their runs side-by-side.

Deployed on Vercel and powered by **AI Gateway** + **Vercel AI SDK**.

---

## How it works

- One shared board: `rows × cols` with `mineCount` hidden mines.
- For each model:
  - The backend sends the **current visible board** and rules.
  - The model returns a JSON move: `{"action":"reveal"|"flag","row":number,"col":number,...}`.
  - The engine applies the move, reveals cells, and updates the visible board.
  - This repeats until the model **wins, hits a mine, gets stuck or errors**.
- The frontend displays all models’ boards in parallel, with a **replay timeline**.

This is a **model evaluation game**:

- Same environment, different strategies.
- Fully automatic scoring.
- Designed for quick, visual comparisons.

---

## Scoring & ranking

For each model run:

- `safeRevealed` – number of non-mine cells revealed.
- `totalSafe` – total non-mine cells on the board.
- `minesHit` – 0 or 1.
- `moves` – total moves made.
- `outcome` – `win | loss | stuck | error`.

Round score:

```text
if outcome === "win":
  score = 100 * (safeRevealed / totalSafe) - 0.5 * (moves - 1)
else:
  score = 100 * (safeRevealed / totalSafe) - 10 * minesHit
```

Ranking for a round:

1. score (desc)
2. outcome priority: win > stuck > loss > error
3. moves (asc)
4. durationMs (asc)

## Tech stack

- Frontend: Next.js (App Router) + TypeScript + Tailwind
- AI: Vercel AI SDK + AI Gateway (OpenAI, Anthropic, etc.)
- Backend: Next.js API routes (server actions) for simulation
- Deployment: Vercel

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Game rules (for models)

- Each turn, a model must output only JSON:

```json
{
  "action": "reveal",
  "row": 3,
  "col": 5,
  "reasoning": "short natural language explanation"
}
```

- Rows/cols are 0-based.
- You may only act on currently hidden cells.
- reveal:
  - If safe → shows number of adjacent mines (0–8), with flood-fill of zero areas.
  - If mine → game over (loss).
- flag (optional) toggles a flag without revealing.

If JSON is invalid or move is illegal, the game may end with `outcome = "error"` or `outcome = "stuck"`.
