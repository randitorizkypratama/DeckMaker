import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { config } from './config.ts'
import { createContainer } from './container.ts'
import { cardRoutes } from './presentation/routes/cards.ts'
import { deckRoutes } from './presentation/routes/decks.ts'
import { favoriteRoutes } from './presentation/routes/favorites.ts'
import { authRoutes } from './presentation/routes/auth.ts'
import { adminRoutes } from './presentation/routes/admin.ts'
import { metaRoutes } from './presentation/routes/meta.ts'
import { fail, mapError } from './presentation/http/responses.ts'

const container = await createContainer()

export const app = new Elysia()
  .use(
    cors({
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-dueldex-owner'],
    }),
  )
  .onError(({ error, code, set }) => {
    // Elysia's own validation failures surface as VALIDATION.
    if (code === 'VALIDATION') {
      set.status = 422
      return fail('VALIDATION_ERROR', 'Request payload is invalid.', String(error))
    }
    if (code === 'NOT_FOUND') {
      set.status = 404
      return fail('NOT_FOUND', 'Endpoint not found.')
    }
    const mapped = mapError(error)
    set.status = mapped.status
    return mapped.body
  })
  .get('/health', () => ({ success: true, data: { status: 'ok' } }))
  .use(authRoutes(container))
  .use(cardRoutes(container))
  .use(deckRoutes(container))
  .use(favoriteRoutes(container))
  .use(adminRoutes(container))
  .use(metaRoutes(container))

// Guard so importing the app in tests does not start a server.
if (import.meta.main) {
  app.listen(config.port, () => {
    console.log(`DuelDex API listening on http://localhost:${config.port}`)
  })
}
