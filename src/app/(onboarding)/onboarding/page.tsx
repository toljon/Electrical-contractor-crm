'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Wrench } from 'lucide-react'

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
    if (!user) {
      setError('Your session has expired. Please sign in again.')
      setLoading(false)
      router.push('/login')
      return
    }

    // Creating the org and linking the profile happen together on the server —
    // they set org_id and role, which the query endpoint will not accept.
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: form.companyName,
        licenseNumber: form.licenseNumber,
        phone: form.phone,
        city: form.city,
        state: form.state,
      }),
    }).catch(() => null)

    if (!res || !res.ok) {
      const json = res ? await res.json().catch(() => null) : null
      setError(json?.error ?? 'Could not create your organization. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="bg-brand rounded-lg p-2">
            <Wrench className="h-6 w-6 text-ink" />
          </div>
          <span className="text-2xl font-bold text-gray-900">TGG Ops</span>
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
                  placeholder="TG Gallagher"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Waltham"
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
                <Label htmlFor="licenseNumber">Contractor license number</Label>
                <Input
                  id="licenseNumber"
                  value={form.licenseNumber}
                  onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                  placeholder="MA PL-12345 / SM-6789"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-ink hover:bg-ink-hover text-white font-semibold"
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
