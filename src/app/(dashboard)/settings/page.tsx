import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Wrench, Database } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8">Account and platform configuration</p>

      {/* Account */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{profile?.full_name ?? '—'}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm items-center">
            <span className="text-gray-500">Role</span>
            <Badge variant="outline">{profile?.role ?? 'technician'}</Badge>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">User ID</span>
            <span className="font-mono text-xs text-gray-400">{user?.id}</span>
          </div>
        </CardContent>
      </Card>

      {/* Platform */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-red-700" />
            <CardTitle className="text-base">TGG Ops Platform</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Trades</span>
            <span>HVAC · Plumbing · Fire Protection</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Report Templates</span>
            <span>ASHRAE 180 · NFPA 25 · Backflow · TAB · Med Gas · Cx</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">PDF Generation</span>
            <Badge className="bg-green-100 text-green-700">Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Storage info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-base">Data & Storage</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Database</span>
            <span>Embedded SQLite — <span className="font-mono text-xs bg-gray-100 px-1 rounded">data/tgg-ops.db</span></span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Photo storage</span>
            <span className="font-mono text-xs bg-gray-100 px-1 rounded self-center">data/uploads/</span>
          </div>
          <Separator />
          <p className="text-gray-500">
            This version runs fully self-contained — no external database service required.
            Back up the <span className="font-mono text-xs bg-gray-100 px-1 rounded">data/</span> directory
            to preserve all records. A hosted Supabase migration path is documented in{' '}
            <span className="font-mono text-xs bg-gray-100 px-1 rounded">docs/SUPABASE_SETUP.md</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
