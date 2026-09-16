import { Elysia, t } from 'elysia'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@dueldex/shared'
import type { Container } from '../../container.ts'
import { mapError, ok } from '../http/responses.ts'

/**
 * Card HTTP routes. Validates and shapes requests, delegates to the
 * application layer, and formats responses.
 */
const cardQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 100 })),
  type: t.Optional(t.String({ maxLength: 60 })),
  attribute: t.Optional(t.String({ maxLength: 20 })),
  race: t.Optional(t.String({ maxLength: 40 })),
  archetype: t.Optional(t.String({ maxLength: 80 })),
  level: t.Optional(t.Numeric({ minimum: 0, maximum: 13 })),
  atk: t.Optional(t.Numeric({ minimum: 0, maximum: 5000 })),
  def: t.Optional(t.Numeric({ minimum: 0, maximum: 5000 })),
  sort: t.Optional(t.String({ maxLength: 20, default: 'name' })),
  sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_PAGE_SIZE })),
})

export function cardRoutes(container: Container) {
  return new Elysia({ prefix: '/api/cards' })
    .get(
      '/',
      async ({ query, set }) => {
        try {
          const result = await container.cardService.search({
            ...query,
            page: query.page ?? 1,
            pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
          })
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      { query: cardQuerySchema },
    )
    // Declared before /:id so "search" is not parsed as an id.
    .get(
      '/search',
      async ({ query, set }) => {
        try {
          const result = await container.cardService.search({
            ...query,
            page: query.page ?? 1,
            pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
          })
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      { query: cardQuerySchema },
    )
    .get(
      '/meta/filters',
      async ({ set }) => {
        try {
          return ok(await container.cardService.getFilterMetadata())
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
    )
    .get(
      '/:id',
      async ({ params, set }) => {
        try {
          return ok(await container.cardService.getById(params.id))
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) },
    )
}
