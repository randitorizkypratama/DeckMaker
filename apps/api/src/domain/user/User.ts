export type Gender = 'male' | 'female'
export type Role = 'user' | 'admin'

export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  displayName?: string | null
  age?: number | null
  gender?: Gender | null
  country?: string | null
  avatar?: string | null // base64 webp data URL, max 5MB
  role: Role
  isBanned: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicUser {
  id: string
  username: string
  email: string
  displayName?: string | null
  age?: number | null
  gender?: Gender | null
  country?: string | null
  avatar?: string | null
  role: Role
  isBanned: boolean
  createdAt: string
  updatedAt: string
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName ?? null,
    age: user.age ?? null,
    gender: user.gender ?? null,
    country: user.country ?? null,
    avatar: user.avatar ?? null,
    role: user.role ?? 'user',
    isBanned: !!user.isBanned,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
