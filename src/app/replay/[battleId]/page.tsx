'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ReplayPlayer } from '@/components/ReplayPlayer'
import { PlaybackControls } from '@/components/PlaybackControls'
import type { GameResult, BoardState } from '@/lib/types'
import { Button } from '@/components/ui/Button'

type BattleData = {
  id: string
  config: { rows: number; cols: number; mineCount: number }
  models: string[]
  status: string
  rankings: GameResult[] | null
  frames: Record<string, Array<{ boardState: BoardState }>>
  results: Record<string, GameResult>
}

function ReplayContent({ battleId }: { battleId: string }) {
  const [battleData, setBattleData] = useState<BattleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (!battleId) {
      queueMicrotask(() => {
        setError('No battle ID provided')
        setLoading(false)
      })
      return
    }

    fetch(`/api/battles/${battleId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Battle not found')
        }
        return res.json()
      })
      .then((data) => {
        setBattleData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to load battle')
        setLoading(false)
      })
  }, [battleId])

  const maxFrames = battleData
    ? Math.max(...battleData.models.map((modelId) => battleData.frames[modelId]?.length || 0))
    : 0

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && maxFrames > 0) {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= maxFrames - 1) {
            setIsPlaying(false)
            return maxFrames - 1
          }
          return prev + 1
        })
      }, 1000 / speed) // Adjust interval based on speed

      return () => clearInterval(interval)
    }
  }, [isPlaying, maxFrames, speed])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((prev) => !prev)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentFrame((prev) => Math.max(0, prev - 1))
        setIsPlaying(false)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentFrame((prev) => Math.min(maxFrames - 1, prev + 1))
        setIsPlaying(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [maxFrames])

  const handleFrameChange = useCallback((frame: number) => {
    setCurrentFrame(frame)
    setIsPlaying(false)
  }, [])

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="mt-4 text-slate-400">Loading battle replay...</p>
      </main>
    )
  }

  if (error || !battleData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-slate-200">Battle Not Found</h1>
          <p className="mb-6 text-slate-400">
            {error || 'The requested battle could not be found.'}
          </p>
          <Button href="/setup">Start New Battle</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 pb-24 text-slate-200">
      <div className="mx-auto w-full max-w-7xl p-8">
        <header className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Battle Replay</h1>
            <Button href="/setup" variant="secondary">
              New Battle
            </Button>
          </div>
          {battleData.config && (
            <p className="text-slate-400">
              Board: {battleData.config.rows}×{battleData.config.cols} with{' '}
              {battleData.config.mineCount} mines
            </p>
          )}
        </header>

        <ReplayPlayer
          models={battleData.models}
          results={battleData.results}
          frames={battleData.frames}
          currentFrame={currentFrame}
        />
      </div>

      <PlaybackControls
        currentFrame={currentFrame}
        maxFrames={maxFrames}
        isPlaying={isPlaying}
        speed={speed}
        onFrameChange={handleFrameChange}
        onPlayPause={handlePlayPause}
        onSpeedChange={setSpeed}
      />
    </main>
  )
}

function ReplayPageWrapper({ params }: { params: Promise<{ battleId: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </main>
      }
    >
      <ReplayPageContent params={params} />
    </Suspense>
  )
}

async function ReplayPageContent({ params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params
  return <ReplayContent battleId={battleId} />
}

export default ReplayPageWrapper
