import { Elysia, t } from 'elysia'
import type { Container } from '../../container.ts'
import { mapError, ok } from '../http/responses.ts'

export function metaRoutes(container: Container) {
  return new Elysia({ prefix: '/api/meta' })
    .get('/overview', async ({ set }) => {
      try {
        return ok(await container.metaService.getOverview())
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .get('/cards', async ({ query, set }) => {
      try {
        const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100)
        return ok(await container.metaService.getTopCards(limit))
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    })
    .get('/decks', async ({ set }) => {
      try {
        return ok(await container.metaService.getDeckStats())
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
}
