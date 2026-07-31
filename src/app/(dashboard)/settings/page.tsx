import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Wrench } from 'lucide-react'
import { demoMode } from '@/lib/demo'

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
        </CardContent>
      </Card>

      {/* Platform */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-brand-ink" />
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
          <Separator />
          <div className="flex justify-between">
            <span className="text-gray-500">AI Executive Summaries</span>
            {process.env.ANTHROPIC_API_KEY ? (
              <Badge className="bg-green-100 text-green-700">Active</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">Not configured</Badge>
            )}
          </div>
          {demoMode() && (
            <>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">Dataset</span>
                <span className="text-gray-600">
                  Demo — sample records, not live service data
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
