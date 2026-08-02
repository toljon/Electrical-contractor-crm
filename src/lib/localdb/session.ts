// Signed session cookies, verifiable in both Node and Edge (middleware)
// runtimes via Web Crypto. Format: <userId>.<expiresMs>.<hmacHex>
import { demoMode } from '@/lib/demo'

export const SESSION_COOKIE = 'tgg_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

const DEV_SECRET = 'tgg-ops-local-dev-secret-change-in-prod'

function secret(): string {
  const configured = process.env.SESSION_SECRET
  if (configured) return configured
  // The fallback is published in this repository, so anyone could mint a cookie
  // for any user id. That is harmless while demo mode is on — /api/auth/demo
  // hands the same session to any visitor anyway — but with real logins enabled
  // it is a silent authentication bypass, so refuse to run instead.
  if (process.env.NODE_ENV === 'production' && !demoMode()) {
    throw new Error(
      'SESSION_SECRET must be set when TGG_DEMO_MODE is off in production.'
    )
  }
  return DEV_SECRET
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createSessionToken(userId: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS
  const payload = `${userId}.${expires}`
  return `${payload}.${await hmac(payload)}`
}

/** Returns the userId if the token is valid and unexpired, else null. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot < 0) return null
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const [userId, expiresStr] = payload.split('.')
  if (!userId || !expiresStr) return null
  if (Number(expiresStr) < Date.now()) return null
  const expected = await hmac(payload)
  if (sig.length !== expected.length) return null
  // constant-time-ish comparison
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0 ? userId : null
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
}
