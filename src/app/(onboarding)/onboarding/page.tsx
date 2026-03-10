'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Zap } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    companyName: '',
    licenseNumber: '',
    phone: '',
    city: '',
    state: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slug = form.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: form.companyName,
        slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        phone: form.phone,
        city: form.city,
        state: form.state,
        license_number: form.licenseNumber,
      })
      .select()
      .single()

    if (orgError) {
      setError(orgError.message)
      setLoading(false)
      return
    }

    // Link profile to org, set role to admin
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: org.id, role: 'admin' })
      .eq('id', user.id)

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="bg-yellow-400 rounded-lg p-2">
            <Zap className="h-6 w-6 text-gray-900" />
          </div>
          <span className="text-2xl font-bold text-gray-900">VoltTrack</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set up your company</CardTitle>
            <CardDescription>This takes 60 seconds. You can update everything later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company name *</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Acme Electrical Testing"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Boston"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    placeholder="MA"
                    maxLength={2}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(617) 555-0100"
                />
              </div>
              <div>
                <Label htmlFor="licenseNumber">Electrical license number</Label>
                <Input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                  placeholder="E-12345"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                disabled={loading}
              >
                {loading ? 'Setting up…' : 'Get started →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
