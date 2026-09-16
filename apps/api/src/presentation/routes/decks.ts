import { Elysia, t } from 'elysia'
import { DECK_FORMATS, DECK_SECTIONS } from '@dueldex/shared'
import { config } from '../../config.ts'
import type { Container } from '../../container.ts'
import { isValidDeckId } from '../../infrastructure/repositories/deck-id.ts'
import { findCombos } from '../../domain/deck/combo-finder.ts'
import { simulateOpeningHand } from '../../domain/deck/hand-simulator.ts'
import { fail, mapError, ok } from '../http/responses.ts'
import { getAuthUser } from '../middleware/auth.ts'

const deckCardSchema = t.Object({
  cardId: t.Integer({ minimum: 1 }),
  quantity: t.Integer({ minimum: 1, maximum: 3 }),
  section: t.Union(DECK_SECTIONS.map((section) => t.Literal(section))),
})

const formatSchema = t.Union(DECK_FORMATS.map((format) => t.Literal(format)))

// Bounded to keep malformed or abusive payloads from reaching the domain.
const deckCardsSchema = t.Array(deckCardSchema, { maxItems: 200 })

export function deckRoutes(container: Container) {
  return new Elysia({ prefix: '/api/decks' })
    .get(
      '/',
      async ({ headers, query, set }) => {
        // List own decks; requires auth, supports q, sort, order, page, pageSize
        const user = getAuthUser(headers as Record<string, string | undefined>)
        if (!user) {
          set.status = 401
          return fail('UNAUTHORIZED', 'Authentication required. Please login to view your decks.')
        }
        try {
          const opts = {
            q: query.q as string | undefined,
            sort: query.sort as string | undefined,
            order: query.order as string | undefined,
            page: query.page ? Number(query.page) : 1,
            pageSize: query.pageSize ? Number(query.pageSize) : 20,
          }
          const result = await container.deckService.listByOwner(user.id, opts)
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        query: t.Object({
          q: t.Optional(t.String({ maxLength: 80 })),
          sort: t.Optional(t.String({ maxLength: 20 })),
          order: t.Optional(t.String({ maxLength: 4 })),
          page: t.Optional(t.Numeric({ minimum: 1 })),
          pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        }),
      },
    )
    .post(
      '/',
      async ({ body, headers, set }) => {
        try {
          const user = getAuthUser(headers as Record<string, string | undefined>)
          // Allow anon create but associate with user if logged in
          const deck = await container.deckService.create(body, user?.id ?? null)
          set.status = 201
          return ok(deck)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 80 }),
          format: formatSchema,
          keyCardId: t.Optional(t.Integer({ minimum: 1 })),
          cards: deckCardsSchema,
          isPublic: t.Optional(t.Boolean()),
        }),
      },
    )
    // Declared before /:id so "generate" is not treated as a deck id.
    .post(
      '/generate',
      async ({ body, headers, set }) => {
        try {
          const user = getAuthUser(headers as Record<string, string | undefined>)
          const result = await container.deckGeneratorService.generate(body, user?.id ?? null)
          return ok(result)
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          format: formatSchema,
          keyCardId: t.Integer({ minimum: 1 }),
          name: t.Optional(t.String({ maxLength: 80 })),
        }),
      },
    )
    .get('/:id', async ({ params, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        return ok(await container.deckService.getById(params.id))
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .put(
      '/:id',
      async ({ params, body, headers, set }) => {
        if (!isValidDeckId(params.id)) {
          set.status = 404
          return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
        }
        try {
          const user = getAuthUser(headers as Record<string, string | undefined>)
          return ok(await container.deckService.update(params.id, body, user?.id ?? null))
        } catch (error) {
          const mapped = mapError(error)
          set.status = mapped.status
          return mapped.body
        }
      },
      {
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
          keyCardId: t.Optional(t.Integer({ minimum: 1 })),
          cards: t.Optional(deckCardsSchema),
          isPublic: t.Optional(t.Boolean()),
        }),
      },
    )
    .delete('/:id', async ({ params, headers, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        const user = getAuthUser(headers as Record<string, string | undefined>)
        await container.deckService.delete(params.id, user?.id ?? null)
        return ok({ id: params.id })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .post('/:id/share', async ({ params, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        // The deck id is already a short public id, so sharing only needs to
        // confirm existence and return the canonical URL.
        const deck = await container.deckService.getById(params.id)
        return ok({
          shareId: deck.id,
          url: `${config.publicWebUrl}/deck/${deck.id}`,
        })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .post('/:id/clone', async ({ params, headers, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        const user = getAuthUser(headers as Record<string, string | undefined>)
        const deck = await container.deckService.clone(params.id, user?.id ?? null)
        set.status = 201
        return ok(deck)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    // --- Combo Finder ---
    .get('/:id/combos', async ({ params, query, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        const deck = await container.deckService.getById(params.id)
        const cardsById = new Map(deck.cards.map(c => [c.card.id, c.card]))
        const deckCards = deck.cards.map(c => ({ cardId: c.cardId, quantity: c.quantity, section: c.section }))
        const combos = findCombos(deckCards, cardsById, { maxCombos: Number(query.max) || 10 })
        return ok({ combos })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        max: t.Optional(t.Numeric({ minimum: 1, maximum: 20 })),
      }),
    })
    // --- Opening Hand Simulator ---
    .get('/:id/simulate', async ({ params, query, set }) => {
      if (!isValidDeckId(params.id)) {
        set.status = 404
        return fail('DECK_NOT_FOUND', 'Deck no longer exists.')
      }
      try {
        const deck = await container.deckService.getById(params.id)
        const cardsById = new Map(deck.cards.map(c => [c.card.id, c.card]))
        const deckCards = deck.cards.map(c => ({ cardId: c.cardId, quantity: c.quantity, section: c.section }))
        const result = simulateOpeningHand(deckCards, cardsById, {
          handSize: Number(query.handSize) || 5,
          trials: Math.min(Number(query.trials) || 1000, 5000),
        })
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        handSize: t.Optional(t.Numeric({ minimum: 1, maximum: 7 })),
        trials: t.Optional(t.Numeric({ minimum: 100, maximum: 5000 })),
      }),
    })
}
