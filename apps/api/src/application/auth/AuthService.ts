import { randomUUID } from 'node:crypto'
import type { UserRepository } from '../../domain/user/UserRepository.ts'
import { DomainError, ValidationError } from '../../domain/errors.ts'
import { signJwt, verifyJwt } from '../../infrastructure/auth/jwt.ts'
import { toPublicUser, type PublicUser, type Role } from '../../domain/user/User.ts'
import type { Gender } from '../../domain/user/User.ts'

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResult {
  user: PublicUser
  token: string
}

export interface UpdateProfileRequest {
  displayName?: string
  age?: number
  gender?: string
  country?: string
  avatar?: string // base64 webp data URL
}

function validateUsername(username: string): string {
  const v = username.trim()
  if (v.length < 3 || v.length > 20) throw new ValidationError('Username must be 3-20 characters.')
  if (!/^[A-Za-z0-9_]+$/.test(v)) throw new ValidationError('Username may only contain letters, numbers and underscores.')
  return v
}

function validateEmail(email: string): string {
  const v = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ValidationError('Invalid email address.')
  return v
}

function validatePassword(password: string): string {
  if (password.length < 6) throw new ValidationError('Password must be at least 6 characters.')
  if (password.length > 128) throw new ValidationError('Password too long.')
  return password
}

function validateDisplayName(v: string): string {
  const t = v.trim()
  if (t.length === 0 || t.length > 50) throw new ValidationError('Display name must be 1-50 characters.')
  return t
}

function validateAge(v: number): number {
  if (!Number.isInteger(v) || v < 1 || v > 120) throw new ValidationError('Age must be integer 1-120.')
  return v
}

function validateGender(v: string): Gender {
  const low = v.toLowerCase()
  if (low !== 'male' && low !== 'female') throw new ValidationError('Gender must be male or female.')
  return low as Gender
}

function validateCountry(v: string): string {
  const t = v.trim()
  if (t.length < 2 || t.length > 56) throw new ValidationError('Country must be 2-56 characters.')
  return t
}

function validateAvatar(v: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new ValidationError('Invalid avatar.')
  // Must be data URL webp
  if (!v.startsWith('data:image/webp;base64,')) throw new ValidationError('Avatar must be WebP data URL (image/webp).')
  const b64 = v.slice('data:image/webp;base64,'.length)
  // Approx size: base64 length * 0.75
  const bytes = Math.floor(b64.length * 0.75)
  const MAX = 5 * 1024 * 1024
  if (bytes > MAX) throw new ValidationError(`Avatar too large: ${Math.round(bytes/1024)}KB exceeds 5MB.`)
  // Also limit total string length to ~7MB base64
  if (v.length > 7 * 1024 * 1024) throw new ValidationError('Avatar data too large.')
  return v
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
  ) {}

  async register(req: RegisterRequest): Promise<AuthResult> {
    const username = validateUsername(req.username)
    const email = validateEmail(req.email)
    const password = validatePassword(req.password)

    const existingUsername = await this.users.findByUsername(username)
    if (existingUsername) throw new DomainError('VALIDATION_ERROR', 'Username already taken.', 409)

    const existingEmail = await this.users.findByEmail(email)
    if (existingEmail) throw new DomainError('VALIDATION_ERROR', 'Email already registered.', 409)

    const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })
    const now = new Date().toISOString()
    const user = await this.users.create({
      id: randomUUID().replace(/-/g, '').slice(0, 16),
      username,
      email,
      passwordHash,
      displayName: null,
      age: null,
      gender: null,
      country: null,
      avatar: null,
      role: 'user',
      isBanned: false,
      createdAt: now,
      updatedAt: now,
    })

    const token = signJwt({ sub: user.id, username: user.username }, this.jwtSecret)
    return { user: toPublicUser(user), token }
  }

  async login(req: LoginRequest): Promise<AuthResult> {
    const username = validateUsername(req.username)
    // For login, allow either username or email? Keep username only for simplicity, but also accept email if contains @
    let user = await this.users.findByUsername(username)
    if (!user && username.includes('@')) {
      user = await this.users.findByEmail(username.toLowerCase())
    }
    if (!user) throw new DomainError('VALIDATION_ERROR', 'Invalid username or password.', 401)
    if (user.isBanned) throw new DomainError('FORBIDDEN', 'This account has been suspended.', 403)

    const ok = await Bun.password.verify(req.password, user.passwordHash)
    if (!ok) throw new DomainError('VALIDATION_ERROR', 'Invalid username or password.', 401)

    const token = signJwt({ sub: user.id, username: user.username }, this.jwtSecret)
    return { user: toPublicUser(user), token }
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user) throw new DomainError('NOT_FOUND', 'User not found.', 404)
    return toPublicUser(user)
  }

  async refresh(token: string): Promise<AuthResult> {
    const payload = verifyJwt(token, this.jwtSecret)
    if (!payload) throw new DomainError('UNAUTHORIZED', 'Invalid or expired token.', 401)
    const user = await this.users.findById(payload.sub)
    if (!user) throw new DomainError('NOT_FOUND', 'User not found.', 404)
    const newToken = signJwt({ sub: user.id, username: user.username }, this.jwtSecret)
    return { user: toPublicUser(user), token: newToken }
  }

  async updateProfile(userId: string, req: UpdateProfileRequest): Promise<PublicUser> {
    const user = await this.users.findById(userId)
    if (!user) throw new DomainError('NOT_FOUND', 'User not found.', 404)

    let changed = false
    if (req.displayName !== undefined) {
      if (req.displayName === null || req.displayName === '') {
        user.displayName = null
      } else {
        user.displayName = validateDisplayName(req.displayName)
      }
      changed = true
    }
    if (req.age !== undefined) {
      if (req.age === null) {
        user.age = null
      } else {
        user.age = validateAge(req.age as number)
      }
      changed = true
    }
    if (req.gender !== undefined) {
      if (req.gender === null || req.gender === '') {
        user.gender = null
      } else {
        user.gender = validateGender(req.gender)
      }
      changed = true
    }
    if (req.country !== undefined) {
      if (req.country === null || req.country === '') {
        user.country = null
      } else {
        user.country = validateCountry(req.country)
      }
      changed = true
    }
    if (req.avatar !== undefined) {
      if (req.avatar === null || req.avatar === '') {
        user.avatar = null
      } else {
        user.avatar = validateAvatar(req.avatar)
      }
      changed = true
    }

    if (changed) {
      user.updatedAt = new Date().toISOString()
      await this.users.update(user)
    }
    return toPublicUser(user)
  }
}
