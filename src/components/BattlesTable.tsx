'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
} from '@tanstack/react-table'
import {
  Eye,
  ChevronUp,
  ChevronDown,
  Search,
  Trophy,
  Skull,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'
import type { GameResult, GameConfig } from '@/lib/types'

type Battle = {
  id: string
  config: GameConfig
  models: string[]
  rankings: GameResult[] | null
  createdAt: number
  completedAt: number | null
}

const columnHelper = createColumnHelper<Battle>()

const outcomeIcons = {
  win: { icon: Trophy, color: 'text-emerald-400' },
  loss: { icon: Skull, color: 'text-red-400' },
  stuck: { icon: HelpCircle, color: 'text-amber-400' },
  error: { icon: AlertCircle, color: 'text-slate-400' },
  playing: { icon: null, color: 'text-blue-400' },
} as const

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp)
    .toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
}

export function BattlesTable({ battles }: { battles: Battle[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'Battle ID',
        cell: (info) => (
          <span className="font-mono text-blue-400">#{info.getValue().slice(-6)}</span>
        ),
      }),
      columnHelper.accessor('models', {
        header: 'Players',
        cell: (info) => {
          const models = info.getValue()
          return (
            <div className="flex flex-wrap gap-1">
              {models.map((model, i) => (
                <span key={model} className="text-slate-300">
                  {model.split('-').slice(0, 2).join('-')}
                  {i < models.length - 1 && <span className="mx-1 text-slate-600">vs</span>}
                </span>
              ))}
            </div>
          )
        },
        enableSorting: false,
      }),
      columnHelper.accessor(
        (row) => {
          const winner = row.rankings?.[0]
          return winner?.modelId || null
        },
        {
          id: 'winner',
          header: 'Winner',
          cell: (info) => {
            const row = info.row.original
            const winner = row.rankings?.[0]
            if (!winner) return <span className="text-slate-500">—</span>

            const outcome = winner.outcome
            const cfg = outcomeIcons[outcome] || outcomeIcons.playing
            const Icon = cfg.icon

            return (
              <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className={cfg.color} />}
                <span
                  className={outcome === 'win' ? 'font-medium text-emerald-400' : 'text-slate-400'}
                >
                  {outcome === 'win' ? winner.modelId.split('-').slice(0, 2).join('-') : 'Tie'}
                </span>
              </div>
            )
          },
        }
      ),
      columnHelper.accessor(
        (row) => {
          const totalMs = row.rankings?.reduce((sum, r) => sum + r.durationMs, 0) || 0
          return totalMs
        },
        {
          id: 'duration',
          header: 'Duration',
          cell: (info) => (
            <span className="font-mono text-slate-400">{formatDuration(info.getValue())}</span>
          ),
        }
      ),
      columnHelper.accessor('completedAt', {
        header: 'Date',
        cell: (info) => {
          const timestamp = info.getValue() || info.row.original.createdAt
          return <span className="text-slate-500">{formatDate(timestamp)}</span>
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => (
          <Link
            href={`/replay/${info.row.original.id}`}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          >
            <Eye size={18} />
          </Link>
        ),
      }),
    ],
    []
  )

  const table = useReactTable({
    data: battles,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by player..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pr-4 pl-10 text-slate-200 placeholder-slate-500 transition-colors focus:border-slate-600 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-700/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-5 py-4 text-left text-xs font-semibold tracking-wider text-slate-400 uppercase ${
                      header.column.getCanSort()
                        ? 'cursor-pointer select-none hover:text-slate-300'
                        : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-slate-600">
                          {{
                            asc: <ChevronUp size={14} className="text-blue-400" />,
                            desc: <ChevronDown size={14} className="text-blue-400" />,
                          }[header.column.getIsSorted() as string] ?? (
                            <div className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-500">
                  No battles found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-700/20">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-4 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
