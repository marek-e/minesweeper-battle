'use client'

import { Suspense, useState } from 'react'
import { useQueryStates } from 'nuqs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Difficulty } from '@/lib/types'
import { gameSearchParams } from '@/lib/searchParams'
import { createBattle } from '@/lib/api'
import {
  AUTHORIZED_MODELS,
  MAX_ROWS,
  MAX_COLS,
  MAX_MINES,
  DIFFICULTIES,
  MODEL_NAMES,
} from '@/lib/battleConfig'
import { CheckboxCard } from './_components/CheckboxCard'
import { InputField } from './_components/InputField'

function SetupContent() {
  const router = useRouter()
  const [config, setConfig] = useQueryStates(gameSearchParams)
  const [isStarting, setIsStarting] = useState(false)

  const { rows, cols, mineCount, models } = config

  const handleDifficultyClick = (difficulty: Difficulty) => {
    const preset = DIFFICULTIES[difficulty]
    setConfig({
      rows: preset.rows,
      cols: preset.cols,
      mineCount: preset.mineCount,
    })
  }

  const handleModelToggle = (modelId: string, isSelected: boolean) => {
    setConfig({
      models: isSelected ? [...models, modelId] : models.filter((id) => id !== modelId),
    })
  }

  const handleStartGame = async () => {
    if (models.length === 0 || isStarting) return

    setIsStarting(true)

    try {
      const { battleId } = await createBattle({ rows, cols, mineCount }, models)
      router.push(`/arena?battleId=${battleId}`)
    } catch (error) {
      console.error('Error starting battle:', error)
      alert(error instanceof Error ? error.message : 'Failed to start battle')
      setIsStarting(false)
    }
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
              max={MAX_ROWS}
              value={rows}
              onChange={(e) => setConfig({ rows: Number(e.target.value) })}
            />
            <InputField
              label="Columns"
              id="cols"
              max={MAX_COLS}
              value={cols}
              onChange={(e) => setConfig({ cols: Number(e.target.value) })}
            />
            <InputField
              label="Number of Mines"
              id="mineCount"
              max={MAX_MINES}
              value={mineCount}
              onChange={(e) => setConfig({ mineCount: Number(e.target.value) })}
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
            {AUTHORIZED_MODELS.map((modelId) => (
              <CheckboxCard
                key={modelId}
                id={modelId}
                label={MODEL_NAMES[modelId] || modelId}
                checked={models.includes(modelId)}
                onChange={(isChecked) => {
                  if (models.length >= 4 && isChecked) {
                    alert('You can only select up to 4 models')
                    return
                  }
                  handleModelToggle(modelId, isChecked)
                }}
              />
            ))}
          </div>
        </section>

        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            onClick={handleStartGame}
            disabled={models.length === 0 || isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Game <ArrowRight size={16} />
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </main>
      }
    >
      <SetupContent />
    </Suspense>
  )
}
