'use client'

import type { BoardState } from '@/lib/types'
import { Cell } from '@/components/Cell'

type BoardGridProps = {
  board: BoardState
  onCellClick?: (row: number, col: number) => void
  onCellContextMenu?: (row: number, col: number) => void
}

export function BoardGrid({ board, onCellClick, onCellContextMenu }: BoardGridProps) {
  const gridStyle = {
    display: 'grid',
    gridTemplateRows: `repeat(${board.length}, minmax(0, 1fr))`,
    gridTemplateColumns: `repeat(${board[0].length}, minmax(0, 1fr))`,
    gap: '2px',
  }

  return (
    <div className="inline-block rounded-lg bg-gray-400 p-1" style={gridStyle}>
      {board.flat().map((cell) => (
        <Cell
          key={`${cell.row}-${cell.col}`}
          state={cell}
          onClick={onCellClick ? () => onCellClick(cell.row, cell.col) : undefined}
          onContextMenu={
            onCellContextMenu
              ? (e) => {
                  e.preventDefault()
                  onCellContextMenu(cell.row, cell.col)
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}
