export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Zap, Database, Key } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single()

  return (
    <div className="p-8 max-w-2xl">
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
            <Zap className="h-4 w-4 text-yellow-500" />
            <CardTitle className="text-base">VoltTrack Platform</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Plan</span>
            <Badge className="bg-yellow-100 text-yellow-700">MVP / Beta</Badge>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">Report Templates</span>
            <span>NFPA 70B · Infrared · Power Systems · Preventative Maintenance</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">PDF Generation</span>
            <Badge className="bg-green-100 text-green-700">Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Setup instructions */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-yellow-600" />
            <CardTitle className="text-base text-yellow-900">Supabase Setup Required</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-yellow-800 space-y-3">
          <p>To fully activate VoltTrack, complete these steps in your Supabase project:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>Create a Supabase project at <span className="font-mono text-xs bg-yellow-100 px-1 rounded">supabase.com</span></li>
            <li>Run the migration SQL from <span className="font-mono text-xs bg-yellow-100 px-1 rounded">supabase/migrations/001_initial_schema.sql</span></li>
            <li>Create a Storage bucket named <span className="font-mono text-xs bg-yellow-100 px-1 rounded">report-photos</span></li>
            <li>Add environment variables to <span className="font-mono text-xs bg-yellow-100 px-1 rounded">.env.local</span></li>
          </ol>
          <div className="mt-3 p-3 bg-white rounded border border-yellow-200 font-mono text-xs space-y-1">
            <div className="text-gray-500"># .env.local</div>
            <div>NEXT_PUBLIC_SUPABASE_URL=your_project_url</div>
            <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key</div>
            <div>SUPABASE_SERVICE_ROLE_KEY=your_service_role_key</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
