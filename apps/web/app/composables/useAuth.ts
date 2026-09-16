import { useApi, ApiRequestError } from './useApi'

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName?: string | null
  age?: number | null
  gender?: 'male' | 'female' | null
  country?: string | null
  avatar?: string | null
  role?: 'user' | 'admin'
  isBanned?: boolean
  createdAt: string
  updatedAt: string
}

interface AuthResponse {
  user: AuthUser
  token: string
}

const TOKEN_KEY = 'dueldex:token'
const USER_KEY = 'dueldex:user'

export function useAuth() {
  const api = useApi()
  const user = useState<AuthUser | null>('dueldex-auth-user', () => null)
  const token = useState<string | null>('dueldex-auth-token', () => null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const initialized = useState<boolean>('dueldex-auth-initialized', () => false)

  function loadFromStorage(): void {
    if (!import.meta.client) return
    if (initialized.value) return
    try {
      const t = window.localStorage.getItem(TOKEN_KEY)
      const u = window.localStorage.getItem(USER_KEY)
      if (t) token.value = t
      if (u) {
        try { user.value = JSON.parse(u) as AuthUser } catch { user.value = null }
      }
    } catch {}
    initialized.value = true
  }

  function saveSession(newToken: string, newUser: AuthUser): void {
    token.value = newToken
    user.value = newUser
    if (import.meta.client) {
      try {
        window.localStorage.setItem(TOKEN_KEY, newToken)
        window.localStorage.setItem(USER_KEY, JSON.stringify(newUser))
      } catch {}
    }
  }

  function clearSession(): void {
    token.value = null
    user.value = null
    error.value = null
    if (import.meta.client) {
      try {
        window.localStorage.removeItem(TOKEN_KEY)
        window.localStorage.removeItem(USER_KEY)
      } catch {}
    }
  }

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function register(username: string, email: string, password: string): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const res = await api.request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: { username, email, password },
      })
      saveSession(res.token, res.user)
      return true
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Registration failed.'
      return false
    } finally {
      pending.value = false
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const res = await api.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      saveSession(res.token, res.user)
      return true
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Login failed.'
      return false
    } finally {
      pending.value = false
    }
  }

  async function fetchMe(): Promise<void> {
    if (!token.value) return
    try {
      const res = await api.request<{ user: AuthUser }>('/api/auth/me')
      user.value = res.user
      if (import.meta.client) {
        try { window.localStorage.setItem(USER_KEY, JSON.stringify(res.user)) } catch {}
      }
    } catch {
      clearSession()
    }
  }

  async function refresh(): Promise<boolean> {
    const t = getToken()
    if (!t) return false
    try {
      const res = await api.request<AuthResponse>('/api/auth/refresh', { method: 'POST' })
      saveSession(res.token, res.user)
      return true
    } catch {
      return false
    }
  }

  async function updateProfile(data: { displayName?: string | null; age?: number | null; gender?: string | null; country?: string | null; avatar?: string | null }): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const res = await api.request<{ user: AuthUser }>('/api/auth/me', { method: 'PUT', body: data } as any)
      user.value = res.user
      if (import.meta.client) {
        try { window.localStorage.setItem(USER_KEY, JSON.stringify(res.user)) } catch {}
      }
      return true
    } catch (e) {
      error.value = e instanceof ApiRequestError ? e.message : 'Update failed.'
      return false
    } finally {
      pending.value = false
    }
  }

  function logout(): void {
    clearSession()
    if (import.meta.client) navigateTo('/login')
  }

  function getToken(): string | null {
    if (token.value) return token.value
    if (import.meta.client) {
      try { return window.localStorage.getItem(TOKEN_KEY) } catch { return null }
    }
    return null
  }

  return {
    user,
    token,
    pending,
    error,
    isAuthenticated,
    initialized,
    loadFromStorage,
    register,
    login,
    fetchMe,
    refresh,
    updateProfile,
    logout,
    getToken,
    clearSession,
  }
}

// Client-side image to WebP converter, 5MB limit
export async function convertToWebP(file: File, maxBytes = 5 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) throw new Error(`File too large: ${Math.round(file.size/1024)}KB exceeds 5MB.`)
  if (!file.type.startsWith('image/')) throw new Error('Please select an image file.')
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported.')
  ctx.drawImage(bitmap, 0, 0)
  const dataUrl: string = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to convert image.'))
        if (blob.size > maxBytes) return reject(new Error(`Converted image too large: ${Math.round(blob.size/1024)}KB exceeds 5MB.`))
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image.'))
        reader.readAsDataURL(blob)
      },
      'image/webp',
      0.8,
    )
  })
  return dataUrl
}
