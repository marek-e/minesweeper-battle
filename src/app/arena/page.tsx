import { getModelState, PersistedModelState } from '@/lib/database/modelState'
import { ArenaContent } from './_components/ArenaContent'
import { getBattleMetadata } from '@/lib/database/battle'

export default async function ArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ battleId?: string }>
}) {
  const { battleId } = await searchParams

  if (!battleId) {
    return (
      <main className="flex flex-col items-center justify-center p-8">
        <p className="text-slate-400">No battle ID provided</p>
      </main>
    )
  }

  const battleMetadata = await getBattleMetadata(battleId)

  const modelStates: Record<string, PersistedModelState> = {}

  for (const modelId of battleMetadata?.models || []) {
    const modelState = await getModelState(battleId, modelId)
    if (modelState) {
      modelStates[modelId] = modelState
    }
  }

  return (
    <ArenaContent battleId={battleId} modelStates={modelStates} battleMetadata={battleMetadata} />
  )
}
