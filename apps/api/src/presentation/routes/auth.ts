import { Elysia, t } from 'elysia'
import type { Container } from '../../container.ts'
import { mapError, ok, fail } from '../http/responses.ts'
import { getAuthUser } from '../middleware/auth.ts'

export function authRoutes(container: Container) {
  return new Elysia({ prefix: '/api/auth' })
    .post(
      '/register',
      async ({ body, set }) => {
        try {
          const result = await container.authService.register(body)
          set.status = 201
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          username: t.String({ minLength: 3, maxLength: 20 }),
          email: t.String({ format: 'email' }),
          password: t.String({ minLength: 6, maxLength: 128 }),
        }),
      },
    )
    .post(
      '/login',
      async ({ body, set }) => {
        try {
          const result = await container.authService.login(body)
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          username: t.String({ minLength: 3, maxLength: 128 }),
          password: t.String({ minLength: 6, maxLength: 128 }),
        }),
      },
    )
    .post('/refresh', async ({ headers, set }) => {
      const auth = headers['authorization'] || (headers as any)['Authorization']
      const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : ''
      if (!token) {
        set.status = 401
        return fail('UNAUTHORIZED', 'Missing token.')
      }
      try {
        const result = await container.authService.refresh(token)
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .get('/me', async ({ headers, set }) => {
      const user = getAuthUser(headers as Record<string, string | undefined>)
      if (!user) {
        set.status = 401
        return fail('UNAUTHORIZED', 'Authentication required.')
      }
      try {
        const profile = await container.authService.me(user.id)
        return ok({ user: profile })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .put(
      '/me',
      async ({ body, headers, set }) => {
        const user = getAuthUser(headers as Record<string, string | undefined>)
        if (!user) {
          set.status = 401
          return fail('UNAUTHORIZED', 'Authentication required.')
        }
        try {
          const profile = await container.authService.updateProfile(user.id, body as any)
          return ok({ user: profile })
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          displayName: t.Optional(t.Union([t.String({ maxLength: 50 }), t.Null()])),
          age: t.Optional(t.Union([t.Integer({ minimum: 1, maximum: 120 }), t.Null()])),
          gender: t.Optional(t.Union([t.Union([t.Literal('male'), t.Literal('female')]), t.Null()])),
          country: t.Optional(t.Union([t.String({ maxLength: 56 }), t.Null()])),
          avatar: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      },
    )
}
