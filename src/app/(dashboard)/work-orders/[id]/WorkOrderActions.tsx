'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { WorkOrderStatus } from '@/types/database'
import {
  UserCheck,
  Navigation,
  MapPin,
  Wrench,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

/** Map each status to the valid next statuses a user can transition to. */
const STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  created: ['assigned', 'cancelled'],
  assigned: ['en_route', 'cancelled'],
  en_route: ['on_site', 'cancelled'],
  on_site: ['in_progress', 'cancelled'],
  in_progress: ['complete', 'cancelled'],
  complete: ['invoiced'],
  invoiced: [],
  cancelled: [],
}

const TRANSITION_CONFIG: Record<
  WorkOrderStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  assigned: {
    label: 'Mark Assigned',
    icon: UserCheck,
    className: 'text-blue-700 border-blue-300 hover:bg-blue-50',
  },
  en_route: {
    label: 'En Route',
    icon: Navigation,
    className: 'text-purple-700 border-purple-300 hover:bg-purple-50',
  },
  on_site: {
    label: 'On Site',
    icon: MapPin,
    className: 'text-indigo-700 border-indigo-300 hover:bg-indigo-50',
  },
  in_progress: {
    label: 'In Progress',
    icon: Wrench,
    className: 'text-yellow-700 border-yellow-300 hover:bg-yellow-50',
  },
  complete: {
    label: 'Mark Complete',
    icon: CheckCircle2,
    className: 'text-green-700 border-green-300 hover:bg-green-50',
  },
  invoiced: {
    label: 'Mark Invoiced',
    icon: CheckCircle2,
    className: 'text-teal-700 border-teal-300 hover:bg-teal-50',
  },
  cancelled: {
    label: 'Cancel',
    icon: XCircle,
    className: 'text-red-700 border-red-300 hover:bg-red-50',
  },
  created: { label: '', icon: CheckCircle2, className: '' }, // never shown
}

export default function WorkOrderActions({
  workOrderId,
  currentStatus,
}: {
  workOrderId: string
  currentStatus: WorkOrderStatus
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const nextStatuses = STATUS_TRANSITIONS[currentStatus]

  async function updateStatus(status: WorkOrderStatus) {
    setLoading(true)
    const { error } = await supabase
      .from('work_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', workOrderId)
    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`Work order marked as ${status.replace(/_/g, ' ')}`)
      router.refresh()
    }
  }

  if (!nextStatuses || nextStatuses.length === 0) return null

  return (
    <div className="flex items-center gap-2 mb-6">
      {nextStatuses.map((status) => {
        const config = TRANSITION_CONFIG[status]
        const Icon = config.icon
        return (
          <Button
            key={status}
            size="sm"
            variant="outline"
            onClick={() => updateStatus(status)}
            disabled={loading}
            className={config.className}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            {config.label}
          </Button>
        )
      })}
    </div>
  )
}
