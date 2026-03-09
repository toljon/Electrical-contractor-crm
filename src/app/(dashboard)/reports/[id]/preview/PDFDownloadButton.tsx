'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FileDown, Loader2 } from 'lucide-react'

export default function PDFDownloadButton({
  reportId,
  variant = 'default',
}: {
  reportId: string
  variant?: 'default' | 'hero'
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf`)
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'PDF generation failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VoltTrack-Report-${reportId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'hero') {
    return (
      <Button
        onClick={handleDownload}
        disabled={loading}
        size="lg"
        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-8"
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating…</>
        ) : (
          <><FileDown className="h-5 w-5 mr-2" /> Download PDF Report</>
        )}
      </Button>
    )
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
    >
      {loading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
      ) : (
        <><FileDown className="h-4 w-4 mr-2" /> Download PDF</>
      )}
    </Button>
  )
}
