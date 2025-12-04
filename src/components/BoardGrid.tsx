// src/components/BoardGrid.tsx
'use client';

import React from 'react';
import type { BoardState } from '@/lib/types';
import { Cell } from './Cell';

type BoardGridProps = {
  board: BoardState;
  onCellClick?: (row: number, col: number) => void;
  onCellContextMenu?: (row: number, col: number) => void;
};

export function BoardGrid({ board, onCellClick, onCellContextMenu }: BoardGridProps) {
  const gridStyle = {
    display: 'grid',
    gridTemplateRows: `repeat(${board.length}, minmax(0, 1fr))`,
    gridTemplateColumns: `repeat(${board[0].length}, minmax(0, 1fr))`,
    gap: '2px',
  };

  return (
    <div className="bg-gray-400 p-1 rounded-lg inline-block" style={gridStyle}>
      {board.flat().map(cell => (
        <Cell
          key={`${cell.row}-${cell.col}`}
          state={cell}
          onClick={onCellClick ? () => onCellClick(cell.row, cell.col) : undefined}
          onContextMenu={
            onCellContextMenu
              ? e => {
                  e.preventDefault();
                  onCellContextMenu(cell.row, cell.col);
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
