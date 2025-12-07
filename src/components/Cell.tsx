'use client'

import React from 'react'
import type { CellState } from '@/lib/types'
import { Flag, Bomb } from 'lucide-react'

export type CellSize = 'sm' | 'md' | 'lg'

type CellProps = {
  state: CellState
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  size?: CellSize
}

const sizeClasses: Record<CellSize, { cell: string; icon: string; bomb: string; text: string }> = {
  sm: { cell: 'w-6 h-6', icon: 'h-3 w-3', bomb: 'h-3.5 w-3.5', text: 'text-xs' },
  md: { cell: 'w-7 h-7', icon: 'h-3.5 w-3.5', bomb: 'h-4 w-4', text: 'text-sm' },
  lg: { cell: 'w-9 h-9 md:w-10 md:h-10', icon: 'h-4 w-4', bomb: 'h-5 w-5', text: 'text-lg' },
}

const getCellContent = (state: CellState, size: CellSize): React.ReactNode => {
  const sizes = sizeClasses[size]
  if (state.isFlagged) return <Flag className={`${sizes.icon} text-orange-400`} />
  if (!state.isRevealed) return null
  if (state.isMine) return <Bomb className={`${sizes.bomb} text-white`} />
  if (state.adjacentMines > 0) return state.adjacentMines
  return null
}

const getCellStyles = (state: CellState, clickable: boolean, size: CellSize): string => {
  const sizes = sizeClasses[size]
  const baseStyle = `${sizes.cell} flex items-center justify-center font-bold ${sizes.text} rounded border`

  if (!state.isRevealed) {
    const interactionStyle = clickable ? 'hover:bg-slate-700 cursor-pointer' : 'cursor-default'
    return `${baseStyle} bg-slate-800 border-slate-700 ${interactionStyle}`
  }

  if (state.isMine) {
    return `${baseStyle} bg-red-500/50 border-red-500`
  }

  const colorMap = [
    'text-slate-500', // 0
    'text-blue-400', // 1
    'text-green-400', // 2
    'text-red-400', // 3
    'text-purple-400', // 4
    'text-yellow-400', // 5
    'text-teal-400', // 6
    'text-white', // 7
    'text-slate-400', // 8
  ]

  return `${baseStyle} bg-slate-800/50 border-slate-700 ${colorMap[state.adjacentMines]}`
}

export function Cell({ state, onClick, onContextMenu, size = 'lg' }: CellProps) {
  return (
    <div
      className={getCellStyles(state, !!onClick, size)}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {getCellContent(state, size)}
    </div>
  )
}
