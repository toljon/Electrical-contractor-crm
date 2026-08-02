import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { shouldRedirectToOnboarding } from '@/lib/auth'
import { demoMode } from '@/lib/demo'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // A signed cookie whose user row no longer exists (reseeded database, or a
  // serverless replica that never saw the signup) still verifies, so the
  // marker tells /login to clear it instead of bouncing back here.
  if (!user) redirect('/login?expired=1')

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (shouldRedirectToOnboarding((profile as { org_id: string | null } | null)?.org_id ?? null)) {
    redirect('/onboarding')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar demo={demoMode()} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
