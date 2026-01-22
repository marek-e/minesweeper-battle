import { ReplayContent } from '@/components/ReplayContent'

export default async function ReplayPage({
  params,
}: {
  params: Promise<{ battleId: string }>
}) {
  const { battleId } = await params
  return <ReplayContent battleId={battleId} />
}
