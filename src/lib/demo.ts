// Demo mode: the app signs every visitor in as the seeded demo user and
// never shows the login screen. On by default — set TGG_DEMO_MODE=0 to
// restore the real login/signup flow. Edge-safe (imported by middleware).
export const DEMO_LOGIN = 'demo@tggallagher.com'

export function demoMode(): boolean {
  return process.env.TGG_DEMO_MODE !== '0'
}
