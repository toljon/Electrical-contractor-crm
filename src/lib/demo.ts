// Demo mode: the app signs every visitor in as the seeded demo user and
// never shows the login screen. On by default — set TGG_DEMO_MODE=0 to
// restore the real login/signup flow. Edge-safe (imported by middleware).
export const DEMO_LOGIN = 'demo@tggallagher.com'

// Anything an operator would plausibly write to mean "off". Matching only the
// exact string '0' left TGG_DEMO_MODE=false silently running with no auth.
const DISABLED = new Set(['0', 'false', 'off', 'no', 'disabled'])

export function demoMode(): boolean {
  const raw = process.env.TGG_DEMO_MODE
  if (raw == null) return true
  return !DISABLED.has(raw.trim().toLowerCase())
}
