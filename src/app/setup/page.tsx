'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'
import { Difficulty, GameConfig } from '@/lib/types'

const LLM_PLAYERS = [
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'llama-3-70b', name: 'Llama 3 70B' },
  { id: 'deepseek-r1', name: 'DeepSeek R1' },
]

const DIFFICULTIES: Record<Difficulty, GameConfig> = {
  beginner: { rows: 9, cols: 9, mineCount: 10 },
  intermediate: { rows: 16, cols: 16, mineCount: 40 },
  expert: { rows: 16, cols: 30, mineCount: 99 },
}

const InputField = ({
  label,
  id,
  ...props
}: {
  label: string
} & React.ComponentProps<'input'>) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-sm text-slate-400">
      {label}
    </label>
    <input
      id={id}
      type="number"
      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
      {...props}
    />
  </div>
)

const CheckboxCard = ({
  label,
  id,
  checked,
  onChange,
}: {
  label: string
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label
    htmlFor={id}
    className={`flex cursor-pointer items-center gap-4 rounded-lg p-4 transition-colors ${
      checked
        ? 'border-blue-500 bg-blue-600/20'
        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
    } border`}
  >
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-6 w-6 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-600"
    />
    <span className="font-medium text-slate-200">{label}</span>
  </label>
)

export default function SetupPage() {
  const [rows, setRows] = useState(16)
  const [cols, setCols] = useState(16)
  const [mineCount, setMineCount] = useState(40)
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-4-turbo', 'gemini-1.5-pro'])

  const handleDifficultyClick = (difficulty: Difficulty) => {
    const config = DIFFICULTIES[difficulty]
    setRows(config.rows)
    setCols(config.cols)
    setMineCount(config.mineCount)
  }

  const handleModelToggle = (modelId: string, isSelected: boolean) => {
    setSelectedModels((prev) =>
      isSelected ? [...prev, modelId] : prev.filter((id) => id !== modelId)
    )
  }

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex flex-col gap-10">
        <h1 className="text-4xl font-bold">Game Setup</h1>

        {/* Board Configuration */}
        <section className="flex flex-col gap-6 rounded-xl border border-slate-700/50 bg-slate-800/30 p-8">
          <h2 className="text-2xl font-semibold">Board Configuration</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <InputField
              label="Rows"
              id="rows"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
            />
            <InputField
              label="Columns"
              id="cols"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
            />
            <InputField
              label="Number of Mines"
              id="mineCount"
              value={mineCount}
              onChange={(e) => setMineCount(Number(e.target.value))}
            />
          </div>
          <div className="mt-2 flex items-center gap-4">
            {Object.keys(DIFFICULTIES).map((d) => {
              const difficulty = d as Difficulty
              const isSelected =
                rows === DIFFICULTIES[difficulty].rows &&
                cols === DIFFICULTIES[difficulty].cols &&
                mineCount === DIFFICULTIES[difficulty].mineCount
              return (
                <Button
                  key={d}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onClick={() => handleDifficultyClick(difficulty)}
                >
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </Button>
              )
            })}
          </div>
        </section>

        {/* Select LLM Players */}
        <section className="flex flex-col gap-6 rounded-xl border border-slate-700/50 bg-slate-800/30 p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Select LLM Players</h2>
            <p className="text-slate-400">Choose one or more models to compare.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {LLM_PLAYERS.map((player) => (
              <CheckboxCard
                key={player.id}
                id={player.id}
                label={player.name}
                checked={selectedModels.includes(player.id)}
                onChange={(isChecked) => handleModelToggle(player.id, isChecked)}
              />
            ))}
          </div>
        </section>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" href="/arena">
            Start Game <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </main>
  )
}
