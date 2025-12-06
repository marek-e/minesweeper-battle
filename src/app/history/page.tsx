'use client'

import { useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { BattleCard } from '@/components/BattleCard'
import { BattlesTable } from '@/components/BattlesTable'
import { Button } from '@/components/ui/Button'
import { useBattles } from '@/hooks/useBattles'

export default function HistoryPage() {
  const [page, setPage] = useState(0)
  const pageSize = 10

  const { data: recentData } = useBattles('complete', 3, 0)
  const { data: battlesData, isLoading } = useBattles('complete', pageSize, page * pageSize)

  const recentBattles = recentData?.battles || []
  const allBattles = battlesData?.battles || []
  const total = battlesData?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) pages.push(i)
    } else {
      pages.push(0)
      if (page > 2) pages.push('ellipsis')

      const start = Math.max(1, page - 1)
      const end = Math.min(totalPages - 2, page + 1)

      for (let i = start; i <= end; i++) pages.push(i)

      if (page < totalPages - 3) pages.push('ellipsis')
      pages.push(totalPages - 1)
    }

    return pages
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-950 p-8 text-slate-200">
      <div className="w-full max-w-7xl">
        <header className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight">Battle History</h1>
            <Button href="/setup">New Battle</Button>
          </div>
          <p className="text-slate-400">View and replay past battles</p>
        </header>

        {/* Recent Battles Section - Cards */}
        {recentBattles.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-2xl font-semibold text-slate-200">Recent Battles</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentBattles.map((battle) => (
                <BattleCard
                  key={battle.id}
                  battleId={battle.id}
                  config={battle.config}
                  models={battle.models}
                  rankings={battle.rankings}
                  createdAt={battle.createdAt}
                  completedAt={battle.completedAt}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Battles Section - Table */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-slate-200">All Battles</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : allBattles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-700/50 bg-slate-800/30 py-12 text-center">
              <p className="mb-4 text-slate-400">
                No battles found. Start a new battle to see it here!
              </p>
              <Button href="/setup">New Battle</Button>
            </div>
          ) : (
            <>
              <BattlesTable battles={allBattles} />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of{' '}
                    {total} entries
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>

                    {getPageNumbers().map((pageNum, idx) =>
                      pageNum === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                          ...
                        </span>
                      ) : (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`min-w-[40px] rounded-md px-3 py-2 text-sm transition-colors ${
                            page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      )
                    )}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
