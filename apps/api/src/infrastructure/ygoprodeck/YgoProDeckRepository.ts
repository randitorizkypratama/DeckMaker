import type {
  Card,
  CardQuery,
  DeckFormat,
  FilterMetadata,
  Paginated,
} from '@dueldex/shared'
import {
  buildPagination,
  CARD_ATTRIBUTES,
  CARD_TYPES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@dueldex/shared'
import { config } from '../../config.ts'
import type { CardRepository } from '../../domain/card/CardRepository.ts'
import { TtlCache } from '../cache/TtlCache.ts'
import { formatQueryValue } from './format-pools.ts'
import { mapCards } from './YgoProDeckMapper.ts'
import type { YgoProDeckClient } from './YgoProDeckClient.ts'

const MONSTER_RACES = [
  'Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur',
  'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine',
  'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster',
  'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
]

/**
 * CardRepository backed by YGOPRODeck.
 *
 * Upstream supports server-side pagination via num/offset plus a meta block,
 * so paging is delegated there instead of downloading the whole card pool.
 */
export class YgoProDeckRepository implements CardRepository {
  private readonly listCache: TtlCache<Paginated<Card>>
  private readonly cardCache: TtlCache<Card | null>
  private readonly poolCache: TtlCache<Card[]>
  private readonly metadataCache: TtlCache<FilterMetadata>

  constructor(private readonly client: YgoProDeckClient) {
    this.listCache = new TtlCache<Paginated<Card>>(config.cacheTtlMs, 300)
    this.cardCache = new TtlCache<Card | null>(config.cacheTtlMs, 1000)
    this.poolCache = new TtlCache<Card[]>(config.cacheTtlMs, 100)
    this.metadataCache = new TtlCache<FilterMetadata>(config.cacheTtlMs, 4)
  }

  async search(query: CardQuery): Promise<Paginated<Card>> {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
    const cacheKey = JSON.stringify({ ...query, page, pageSize })

    const sortField = query.sort === 'atk' || query.sort === 'def' || query.sort === 'level' ? query.sort : null

    return this.listCache.getOrSet(cacheKey, async () => {
      if (sortField) {
        // ATK/DEF/Level sort: fetch ALL monsters from upstream, sort client-side
        const monsterTypes = [
          'Effect Monster','Flip Effect Monster','Gemini Monster',
          'Normal Monster','Normal Tuner Monster','Pendulum Effect Monster',
          'Ritual Effect Monster','Ritual Monster','Tuner Monster',
          'Union Effect Monster','Fusion Monster','Synchro Monster',
          'Synchro Tuner Monster','XYZ Monster','Link Monster',
          'Pendulum Normal Monster','Pendulum Tuner Effect Monster',
        ]
        const allMonsters: Card[] = []
        for (const type of monsterTypes) {
          try {
            const params: Record<string, string | number | undefined> = { num: 1000, offset: 0, type }
            if (query.attribute) params.attribute = query.attribute
            if (query.race) params.race = query.race
            if (query.archetype) params.archetype = query.archetype
            if (typeof query.level === 'number') params.level = query.level
            if (query.search) params.fname = query.search
            const response = await this.client.cardInfo(params)
            allMonsters.push(...mapCards(response.data))
          } catch { /* skip */ }
        }
        const seen = new Set<number>()
        const unique = allMonsters.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
        const desc = query.sortOrder !== 'asc'
        unique.sort((a, b) => {
          const aVal = typeof a[sortField] === 'number' ? a[sortField]! : -1
          const bVal = typeof b[sortField] === 'number' ? b[sortField]! : -1
          return desc ? bVal - aVal : aVal - bVal
        })
        const total = unique.length
        const start = (page - 1) * pageSize
        return { items: unique.slice(start, start + pageSize), pagination: buildPagination(page, pageSize, total) }
      }

      // Name / default sort: all cards from upstream
      const params: Record<string, string | number | undefined> = {
        num: pageSize, offset: (page - 1) * pageSize, sort: 'name',
      }
      if (query.search) params.fname = query.search
      if (query.type) params.type = query.type
      if (query.attribute) params.attribute = query.attribute
      if (query.race) params.race = query.race
      if (typeof query.level === 'number') params.level = query.level
      if (query.archetype) params.archetype = query.archetype
      if (typeof query.atk === 'number') params.atk = query.atk
      if (typeof query.def === 'number') params.def = query.def

      const response = await this.client.cardInfo(params)
      let items = mapCards(response.data)
      if (query.sort === 'name') {
        const desc = query.sortOrder === 'desc'
        items.sort((a, b) => desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name))
      }
      const total = response.meta?.total_rows ?? items.length
      return { items, pagination: buildPagination(page, pageSize, total) }
    })
  }

  async findById(id: number): Promise<Card | null> {
    return this.cardCache.getOrSet(`card:${id}`, async () => {
      const response = await this.client.cardInfo({ id })
      const [card] = mapCards(response.data)
      return card ?? null
    })
  }

  async findByIds(ids: number[]): Promise<Card[]> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) return []

    const resolved: Card[] = []
    const missing: number[] = []

    for (const id of unique) {
      const cached = this.cardCache.get(`card:${id}`)
      if (cached === undefined) missing.push(id)
      else if (cached !== null) resolved.push(cached)
    }

    if (missing.length > 0) {
      // Upstream accepts comma-separated ids, so one call covers the rest.
      const response = await this.client.cardInfo({ id: missing.join(',') })
      const fetched = mapCards(response.data)
      for (const card of fetched) {
        this.cardCache.set(`card:${card.id}`, card)
        resolved.push(card)
      }
    }

    const order = new Map(unique.map((id, index) => [id, index]))
    return resolved.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  async findByArchetype(archetype: string): Promise<Card[]> {
    return this.poolCache.getOrSet(`archetype:${archetype}`, async () => {
      const response = await this.client.cardInfo({ archetype })
      return mapCards(response.data)
    })
  }

  async findByText(text: string): Promise<Card[]> {
    const trimmed = text.trim()
    if (trimmed.length === 0) return []
    return this.poolCache.getOrSet(`text:${trimmed}`, async () => {
      const response = await this.client.cardInfo({ fname: trimmed })
      return mapCards(response.data)
    })
  }

  /**
   * Candidate pool for deck generation, scoped to the format's legal cards.
   */
  async findFormatPool(format: DeckFormat, limit = 400): Promise<Card[]> {
    const formatValue = formatQueryValue(format)
    return this.poolCache.getOrSet(`pool:${format}:${limit}`, async () => {
      const response = await this.client.cardInfo({
        num: limit,
        offset: 0,
        sort: 'name',
        format: formatValue,
      })
      return mapCards(response.data)
    })
  }

  /**
   * Staple cards used to fill remaining deck slots with useful generics.
   */
  async findStaples(format: DeckFormat, limit = 120): Promise<Card[]> {
    const formatValue = formatQueryValue(format)
    return this.poolCache.getOrSet(`staples:${format}:${limit}`, async () => {
      const response = await this.client.cardInfo({
        staple: 'yes',
        num: limit,
        offset: 0,
        sort: 'name',
        format: formatValue,
      })
      return mapCards(response.data)
    })
  }

  async findBannedCards(banlist: 'tcg' | 'ocg' = 'tcg'): Promise<Card[]> {
    const cacheKey = `banned:${banlist}`
    return this.poolCache.getOrSet(cacheKey, async () => {
      const response = await this.client.cardInfo({ banlist, num: 500, offset: 0, sort: 'name' })
      return mapCards(response.data)
    })
  }

  async getFilterMetadata(): Promise<FilterMetadata> {
    return this.metadataCache.getOrSet('metadata', async () => {
      // Types/attributes/races are stable API enums; archetypes come from upstream.
      let archetypes: string[] = []
      try {
        archetypes = await this.client.archetypes()
      } catch {
        // Filter metadata is non-critical - degrade rather than fail the request.
        archetypes = []
      }

      return {
        types: [...CARD_TYPES],
        attributes: [...CARD_ATTRIBUTES],
        races: MONSTER_RACES,
        archetypes: archetypes.sort((a, b) => a.localeCompare(b)),
        levels: Array.from({ length: 12 }, (_, index) => index + 1),
      }
    })
  }
}
