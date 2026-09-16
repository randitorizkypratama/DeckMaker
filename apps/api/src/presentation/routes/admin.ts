import { Elysia, t } from 'elysia'
import type { Container } from '../../container.ts'
import { mapError, ok, fail } from '../http/responses.ts'
import { getAuthUser } from '../middleware/auth.ts'

async function requireAdmin(container: Container, headers: Record<string, string | undefined>, set: any) {
  const user = getAuthUser(headers)
  if (!user) { set.status = 401; return { fail: true, body: fail('UNAUTHORIZED', 'Authentication required.') } }
  const isAdmin = await container.adminService.isAdmin(user.id)
  if (!isAdmin) { set.status = 403; return { fail: true, body: fail('FORBIDDEN', 'Admin access required.') } }
  return { fail: false, user }
}

export function adminRoutes(container: Container) {
  return new Elysia({ prefix: '/api/admin' })
    // --- Users ---
    .get('/users', async ({ headers, query, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.listUsers({ q: query.q as string, page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20 })
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        q: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    })
    .get('/users/:id', async ({ headers, params, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.getUser(params.id)
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .put('/users/:id', async ({ headers, params, body, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.updateUser(params.id, body as any)
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      body: t.Object({
        role: t.Optional(t.Union([t.Literal('user'), t.Literal('admin')])),
        isBanned: t.Optional(t.Boolean()),
        displayName: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    })
    .delete('/users/:id', async ({ headers, params, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        await container.adminService.deleteUser(params.id)
        return ok({ deleted: true })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    // --- Decks (admin view all) ---
    .get('/decks', async ({ headers, query, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.listAllDecks({ q: query.q as string, page: Number(query.page) || 1, pageSize: Number(query.pageSize) || 20 })
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        q: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    })
    .delete('/decks/:id', async ({ headers, params, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        await container.adminService.deleteDeck(params.id)
        return ok({ deleted: true })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    // --- Banlist ---
    .get('/banlist/official', async ({ headers, query, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.cardService.getOfficialBanlist((query.banlist as 'tcg' | 'ocg') || 'tcg')
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      query: t.Object({
        banlist: t.Optional(t.Union([t.Literal('tcg'), t.Literal('ocg')])),
      }),
    })
    .get('/banlist', async ({ headers, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.listBanlist()
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    .post('/banlist', async ({ headers, body, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.addBanlistEntry(body.cardId, body.status, body.reason ?? null, (auth as any).user.id)
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    }, {
      body: t.Object({
        cardId: t.Number({ minimum: 1 }),
        status: t.Union([t.Literal('Forbidden'), t.Literal('Limited'), t.Literal('Semi-Limited')]),
        reason: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    })
    .delete('/banlist/:cardId', async ({ headers, params, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        await container.adminService.removeBanlistEntry(Number(params.cardId))
        return ok({ deleted: true })
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
    // --- Stats ---
    .get('/stats', async ({ headers, set }) => {
      const auth = await requireAdmin(container, headers as Record<string, string | undefined>, set)
      if (auth.fail) return auth.body
      try {
        const result = await container.adminService.getStats()
        return ok(result)
      } catch (error) {
        const mapped = mapError(error)
        set.status = mapped.status
        return mapped.body
      }
    })
}
