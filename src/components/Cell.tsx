'use client'

import React from 'react'
import type { CellState } from '@/lib/types'
import { Flag, Bomb } from 'lucide-react'

type CellProps = {
  state: CellState
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

const getCellContent = (state: CellState): React.ReactNode => {
  if (state.isFlagged) return <Flag className="h-4 w-4 text-white" />
  if (!state.isRevealed) return null
  if (state.isMine) return <Bomb className="h-5 w-5 text-white" />
  if (state.adjacentMines > 0) return state.adjacentMines
  return null
}

const getCellStyles = (state: CellState, clickable: boolean): string => {
  const baseStyle =
    'w-9 h-9 md:w-10 md:h-10 flex items-center justify-center font-bold text-lg rounded border'

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
    'text-orange-400', // 5
    'text-teal-400', // 6
    'text-white', // 7
    'text-slate-400', // 8
  ]

  return `${baseStyle} bg-slate-800/50 border-slate-700 ${colorMap[state.adjacentMines]}`
}

export function Cell({ state, onClick, onContextMenu }: CellProps) {
  return (
    <div
      className={getCellStyles(state, !!onClick)}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {getCellContent(state)}
    </div>
  )
}
