'use client'

import { ChevronsLeft, Play, Pause, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'

type PlaybackControlsProps = {
  currentFrame: number
  maxFrames: number
  isPlaying: boolean
  speed: number
  onFrameChange: (frame: number) => void
  onPlayPause: () => void
  onSpeedChange: (speed: number) => void
}

export function PlaybackControls({
  currentFrame,
  maxFrames,
  isPlaying,
  speed,
  onFrameChange,
  onPlayPause,
  onSpeedChange,
}: PlaybackControlsProps) {
  const [localFrame, setLocalFrame] = useState(currentFrame)

  useEffect(() => {
    setLocalFrame(currentFrame)
  }, [currentFrame])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrame = parseInt(e.target.value, 10)
    setLocalFrame(newFrame)
    onFrameChange(newFrame)
  }

  const goToFirst = () => onFrameChange(0)
  const goToLast = () => onFrameChange(maxFrames - 1)
  const goToPrevious = () => onFrameChange(Math.max(0, currentFrame - 1))
  const goToNext = () => onFrameChange(Math.min(maxFrames - 1, currentFrame + 1))

  return (
    <div className="fixed right-0 bottom-0 left-0 border-t border-slate-700 bg-slate-900 p-4">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        {/* First/Previous/Play/Next/Last buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToFirst}
            className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="First frame"
          >
            <ChevronsLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToPrevious}
            className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Previous frame"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onPlayPause}
            className="rounded-full bg-blue-600 p-3 text-white transition-colors hover:bg-blue-700"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            onClick={goToNext}
            className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Next frame"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={goToLast}
            className="rounded p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Last frame"
          >
            <ChevronsRight className="h-5 w-5" />
          </button>
        </div>

        {/* Turn counter */}
        <div className="min-w-[80px] font-medium text-slate-300">Turn {currentFrame + 1}</div>

        {/* Slider */}
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={Math.max(0, maxFrames - 1)}
            value={localFrame}
            onChange={handleSliderChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-blue-600"
            style={{
              background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${
                (localFrame / Math.max(1, maxFrames - 1)) * 100
              }%, rgb(51, 65, 85) ${(localFrame / Math.max(1, maxFrames - 1)) * 100}%, rgb(51, 65, 85) 100%)`,
            }}
          />
          <div className="mt-1 text-right text-xs text-slate-500">{maxFrames}</div>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <select
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>
    </div>
  )
}
