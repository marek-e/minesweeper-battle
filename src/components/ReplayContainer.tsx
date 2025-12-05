'use client'

import React, { useState } from 'react'
import type { GameResult, ReplayFrame } from '@/lib/types'
import { ModelReplay } from './ModelReplay'

type SimulationResult = {
  result: Omit<GameResult, 'score' | 'totalSafe'>
  replayLog: ReplayFrame[]
}

type ReplayContainerProps = {
  simulations: SimulationResult[]
}

export function ReplayContainer({ simulations }: ReplayContainerProps) {
  const [step, setStep] = useState(0)

  if (!simulations || simulations.length === 0) {
    return null
  }

  const maxSteps = Math.max(...simulations.map((s) => s.replayLog.length))

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStep(Number(e.target.value))
  }

  return (
    <div className="w-full space-y-8">
      {/* Timeline Slider */}
      <div className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-2">
        <label htmlFor="timeline" className="mb-2 block text-sm font-medium text-gray-700">
          Replay Timeline (Move: {step})
        </label>
        <input
          id="timeline"
          type="range"
          min="0"
          max={maxSteps - 1}
          value={step}
          onChange={handleSliderChange}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200"
        />
      </div>

      {/* Replay Grids */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {simulations.map(({ result, replayLog }) => {
          // Determine the board state for the current step, clamping to the last available frame
          const currentFrameIndex = Math.min(step, replayLog.length - 1)
          const currentFrame = replayLog[currentFrameIndex]
          const boardState = currentFrame.boardState

          // Determine the outcome and moves at the current step
          const isFinished = result.outcome !== 'playing' && step >= replayLog.length - 1
          const currentOutcome = isFinished ? result.outcome : 'playing'
          const currentMoves = Math.min(step, result.moves)

          return (
            <ModelReplay
              key={result.modelId}
              modelId={result.modelId}
              board={boardState}
              outcome={currentOutcome}
              moves={currentMoves}
              safeRevealed={result.safeRevealed} // This shows final count, could be improved
            />
          )
        })}
      </div>
    </div>
  )
}
