import { createHmac } from 'node:crypto'

function base64UrlEncode(input: string | Buffer): string {
  const b64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64').toString('utf-8')
}

export interface JwtPayload {
  sub: string
  username: string
  iat: number
  exp: number
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresInSec = 7 * 24 * 3600): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const full: JwtPayload = { ...payload, iat: now, exp: now + expiresInSec }
  const body = base64UrlEncode(JSON.stringify(full))
  const sig = base64UrlEncode(createHmac('sha256', secret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  if (!header || !body || !sig) return null
  const expected = base64UrlEncode(createHmac('sha256', secret).update(`${header}.${body}`).digest())
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && now > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
