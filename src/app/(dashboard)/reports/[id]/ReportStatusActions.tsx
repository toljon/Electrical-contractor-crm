'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { ReportStatus } from '@/types/database'
import { CheckCircle2, Send } from 'lucide-react'

export default function ReportStatusActions({
  reportId,
  currentStatus,
}: {
  reportId: string
  currentStatus: ReportStatus
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function updateStatus(status: ReportStatus) {
    setLoading(true)
    const { error } = await supabase
      .from('test_reports')
      .update({ status })
      .eq('id', reportId)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Report marked as ${status}`)
      router.refresh()
    }
  }

  if (currentStatus === 'sent') return null

  return (
    <div className="flex items-center gap-2 mb-6">
      {currentStatus === 'draft' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('complete')}
          disabled={loading}
          className="text-green-700 border-green-300 hover:bg-green-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Mark Complete
        </Button>
      )}
      {currentStatus === 'complete' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('sent')}
          disabled={loading}
          className="text-blue-700 border-blue-300 hover:bg-blue-50"
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Mark as Sent
        </Button>
      )}
    </div>
  )
}
