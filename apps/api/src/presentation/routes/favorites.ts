import { Elysia, t } from 'elysia'
import type { Container } from '../../container.ts'
import { fail, mapError, ok } from '../http/responses.ts'
import { getAuthUser } from '../middleware/auth.ts'

export function favoriteRoutes(container: Container) {
  return new Elysia({ prefix: '/api/favorites' })
    .get('/', async ({ headers, set }) => {
      try {
        const user = getAuthUser(headers as Record<string, string | undefined>)
        if (!user) {
          set.status = 401
          return fail('UNAUTHORIZED', 'Authentication required. Please login.')
        }
        return ok(await container.favoritesService.list(user.id))
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .post(
      '/',
      async ({ body, headers, set }) => {
        try {
          const user = getAuthUser(headers as Record<string, string | undefined>)
          if (!user) {
            set.status = 401
            return fail('UNAUTHORIZED', 'Authentication required. Please login.')
          }
          const card = await container.favoritesService.add(user.id, body.cardId)
          set.status = 201
          return ok(card)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      { body: t.Object({ cardId: t.Integer({ minimum: 1 }) }) },
    )
    .delete(
      '/:cardId',
      async ({ params, headers, set }) => {
        try {
          const user = getAuthUser(headers as Record<string, string | undefined>)
          if (!user) {
            set.status = 401
            return fail('UNAUTHORIZED', 'Authentication required.')
          }
          await container.favoritesService.remove(user.id, params.cardId)
          return ok({ cardId: params.cardId })
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      { params: t.Object({ cardId: t.Numeric({ minimum: 1 }) }) },
    )
    .delete('/', async ({ headers, set }) => {
      try {
        const user = getAuthUser(headers as Record<string, string | undefined>)
        if (!user) {
          set.status = 401
          return fail('UNAUTHORIZED', 'Authentication required.')
        }
        await container.favoritesService.clear(user.id)
        return ok({ cleared: true })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
}
