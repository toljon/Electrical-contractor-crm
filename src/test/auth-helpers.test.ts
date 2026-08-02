import { shouldRedirectToOnboarding } from '@/lib/auth'

describe('auth helpers', () => {
  it('requires onboarding when org_id is null', () => {
    expect(shouldRedirectToOnboarding(null)).toBe(true)
  })

  it('does not require onboarding when org_id is set', () => {
    expect(shouldRedirectToOnboarding('some-uuid')).toBe(false)
  })
})
