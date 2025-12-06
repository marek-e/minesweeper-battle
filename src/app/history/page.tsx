'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BattleCard } from '@/components/BattleCard'
import { Button } from '@/components/ui/Button'
import { useBattles } from '@/hooks/useBattles'

export default function HistoryPage() {
  const [page, setPage] = useState(0)
  const pageSize = 20

  const { data: recentData } = useBattles('complete', 5, 0)
  const { data: battlesData, isLoading } = useBattles('complete', pageSize, page * pageSize)

  const recentBattles = recentData?.battles || []
  const allBattles = battlesData?.battles || []
  const total = battlesData?.total || 0
  const totalPages = Math.ceil(total / pageSize)

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

        {/* Recent Battles Section */}
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

        {/* All Battles Section */}
        <section>
          <h2 className="mb-4 text-2xl font-semibold text-slate-200">All Battles</h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : allBattles.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p>No battles found. Start a new battle to see it here!</p>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allBattles.map((battle) => (
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
