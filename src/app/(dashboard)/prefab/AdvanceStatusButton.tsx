'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { ASSEMBLY_STATUS_LABELS } from '@/types/database'
import type { AssemblyStatus } from '@/types/database'

const PIPELINE: AssemblyStatus[] = [
  'modeled', 'released', 'in_fabrication', 'qc', 'shipped', 'delivered', 'installed',
]

export default function AdvanceStatusButton({
  assemblyId,
  status,
}: {
  assemblyId: string
  status: AssemblyStatus
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const nextStatus = PIPELINE[PIPELINE.indexOf(status) + 1]
  if (!nextStatus) return null

  async function advance() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const values: Record<string, unknown> = { status: nextStatus }
    if (nextStatus === 'shipped') values.shipped_at = today
    if (nextStatus === 'installed') values.installed_at = today

    const { error } = await supabase
      .from('prefab_assemblies')
      .update(values)
      .eq('id', assemblyId)

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Moved to ${ASSEMBLY_STATUS_LABELS[nextStatus]}`)
    router.refresh()
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={advance}
      disabled={loading}
      className="h-7 text-xs"
      title={`Advance to ${ASSEMBLY_STATUS_LABELS[nextStatus]}`}
    >
      {ASSEMBLY_STATUS_LABELS[nextStatus]}
      <ArrowRight className="h-3 w-3 ml-1" />
    </Button>
  )
}
