import type { Elysia } from 'elysia'
import { verifyJwt } from '../../infrastructure/auth/jwt.ts'
import { config } from '../../config.ts'

export interface AuthUser {
  id: string
  username: string
}

export function getAuthUser(headers: Record<string, string | undefined>): AuthUser | null {
  const auth = headers['authorization'] || headers['Authorization']
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1]
  if (!token) return null
  const payload = verifyJwt(token.trim(), config.jwtSecret)
  if (!payload) return null
  return { id: payload.sub, username: payload.username }
}

// Elysia derive helper
export function authDerive(headers: Record<string, string | undefined>) {
  const user = getAuthUser(headers as Record<string, string | undefined>)
  return { user }
}

export function requireAuth(user: AuthUser | null) {
  if (!user) {
    const err: any = new Error('Authentication required.')
    err.code = 'UNAUTHORIZED'
    err.status = 401
    throw err
  }
  return user
}

export function requireAdmin(user: AuthUser | null) {
  requireAuth(user)
  // role check happens via AdminService — middleware just ensures auth is present
  return user!
}
