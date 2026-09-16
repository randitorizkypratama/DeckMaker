import type {
  Card,
  DeckCard,
  DeckDetail,
  DeckFormat,
  DeckRecommendation,
  DeckSectionName,
} from '@dueldex/shared'
import { cardKindOf, getFormatRules, isExtraDeckCard } from '@dueldex/shared'
import { ApiRequestError, useApi } from './useApi'

export interface DeckEntry extends DeckCard {
  card: Card
}

/**
 * Deck builder state.
 *
 * Quantity and placement rules come from the shared format-rules layer so the
 * UI mirrors the server. The backend still re-validates on save - client
 * validation is a convenience, never the authority.
 */
export function useDeck(initialFormat: DeckFormat = 'yu-gi-oh') {
  const api = useApi()

  const format = ref<DeckFormat>(initialFormat)
  const name = ref('Untitled Deck')
  const keyCardId = ref<number | undefined>(undefined)
  const entries = ref<DeckEntry[]>([])
  const savedDeckId = ref<string | null>(null)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const rules = computed(() => getFormatRules(format.value))

  function sectionFor(card: Card): DeckSectionName {
    return rules.value.hasExtraDeck && isExtraDeckCard(card) ? 'extra' : 'main'
  }

  function copiesOf(cardId: number): number {
    return entries.value
      .filter((entry) => entry.cardId === cardId)
      .reduce((total, entry) => total + entry.quantity, 0)
  }

  const sections = computed(() => {
    const grouped: Record<DeckSectionName, DeckEntry[]> = { main: [], extra: [], side: [] }
    for (const entry of entries.value) grouped[entry.section].push(entry)
    return grouped
  })

  const counts = computed(() => ({
    main: sections.value.main.reduce((total, entry) => total + entry.quantity, 0),
    extra: sections.value.extra.reduce((total, entry) => total + entry.quantity, 0),
    side: sections.value.side.reduce((total, entry) => total + entry.quantity, 0),
  }))

  const breakdown = computed(() => {
    let monster = 0
    let spell = 0
    let trap = 0
    for (const entry of entries.value) {
      if (entry.section !== 'main') continue
      const kind = cardKindOf(entry.card.type)
      if (kind === 'monster') monster += entry.quantity
      else if (kind === 'spell') spell += entry.quantity
      else trap += entry.quantity
    }
    return { monster, spell, trap }
  })

  /** Client-side rule feedback. The server remains the source of truth. */
  const validation = computed(() => {
    const issues: string[] = []
    const { main, extra, side } = counts.value
    const current = rules.value

    if (main < current.mainDeckMin) {
      issues.push(`Main Deck needs at least ${current.mainDeckMin} cards (currently ${main}).`)
    }
    if (main > current.mainDeckMax) {
      issues.push(`Main Deck allows at most ${current.mainDeckMax} cards (currently ${main}).`)
    }
    if (!current.hasExtraDeck && extra > 0) {
      issues.push(`${current.label} does not use an Extra Deck.`)
    } else if (extra > current.extraDeckMax) {
      issues.push(`Extra Deck allows at most ${current.extraDeckMax} cards.`)
    }
    if (!current.hasSideDeck && side > 0) {
      issues.push(`${current.label} does not use a Side Deck.`)
    } else if (side > current.sideDeckMax) {
      issues.push(`Side Deck allows at most ${current.sideDeckMax} cards.`)
    }

    // Banlist validation (TCG)
    const seen = new Map<number, { name: string; copies: number; status: string; limit: number }>()
    for (const entry of entries.value) {
      const ban = entry.card.banlist?.tcg
      if (!ban) continue
      const existing = seen.get(entry.cardId)
      if (existing) {
        existing.copies += entry.quantity
      } else {
        const limit = ban === 'Forbidden' ? 0 : ban === 'Limited' ? 1 : 2
        seen.set(entry.cardId, { name: entry.card.name, copies: entry.quantity, status: ban, limit })
      }
    }
    for (const [, info] of seen) {
      if (info.copies > info.limit) {
        const label = info.status === 'Forbidden' ? 'Forbidden' : info.status === 'Limited' ? 'Limited to 1' : 'Semi-Limited to 2'
        issues.push(`${info.name} is ${label} — you have ${info.copies}.`)
      }
    }

    return { valid: issues.length === 0, issues }
  })

  function addCard(card: Card, quantity = 1, section?: DeckSectionName): void {
    const target = section ?? sectionFor(card)
    const room = rules.value.maxCopiesPerCard - copiesOf(card.id)
    const toAdd = Math.min(quantity, room)
    if (toAdd <= 0) return

    const existing = entries.value.find(
      (entry) => entry.cardId === card.id && entry.section === target,
    )
    if (existing) {
      existing.quantity += toAdd
    } else {
      entries.value = [
        ...entries.value,
        { cardId: card.id, quantity: toAdd, section: target, card },
      ]
    }
  }

  function removeCard(cardId: number, section?: DeckSectionName): void {
    entries.value = entries.value.filter(
      (entry) =>
        !(entry.cardId === cardId && (section === undefined || entry.section === section)),
    )
  }

  function increaseQuantity(cardId: number, section: DeckSectionName): void {
    if (copiesOf(cardId) >= rules.value.maxCopiesPerCard) return
    const entry = entries.value.find(
      (item) => item.cardId === cardId && item.section === section,
    )
    if (entry) entry.quantity += 1
  }

  function decreaseQuantity(cardId: number, section: DeckSectionName): void {
    const entry = entries.value.find(
      (item) => item.cardId === cardId && item.section === section,
    )
    if (!entry) return
    if (entry.quantity <= 1) removeCard(cardId, section)
    else entry.quantity -= 1
  }

  function clear(): void {
    entries.value = []
    savedDeckId.value = null
  }

  function rename(next: string): void {
    name.value = next
  }

  /**
   * Switching format re-homes cards that the new format places differently
   * (for example Extra Deck monsters when moving to Rush).
   */
  function setFormat(next: DeckFormat): void {
    format.value = next
    const nextRules = getFormatRules(next)
    entries.value = entries.value
      .filter((entry) => nextRules.hasSideDeck || entry.section !== 'side')
      .map((entry) => ({ ...entry, section: sectionFor(entry.card) }))
  }

  function loadFromDeck(deck: DeckDetail, isGenerated = false): void {
    format.value = deck.format
    name.value = deck.name
    keyCardId.value = deck.keyCardId
    // Only set savedDeckId if loading an existing deck, not a generated one
    if (!isGenerated) {
      savedDeckId.value = deck.id
    }
    entries.value = deck.cards.map((entry) => ({
      cardId: entry.cardId,
      quantity: entry.quantity,
      section: entry.section,
      card: entry.card,
    }))
  }

  function toPayload(): DeckCard[] {
    return entries.value.map((entry) => ({
      cardId: entry.cardId,
      quantity: entry.quantity,
      section: entry.section,
    }))
  }

  async function save(): Promise<DeckDetail | null> {
    saving.value = true
    error.value = null
    try {
      const body: Record<string, unknown> = {
        name: name.value,
        format: format.value,
        cards: toPayload(),
      }
      if (keyCardId.value !== undefined) body.keyCardId = keyCardId.value

      const deck = savedDeckId.value
        ? await api.request<DeckDetail>(`/api/decks/${savedDeckId.value}`, {
            method: 'PUT',
            body: { name: name.value, cards: toPayload(), keyCardId: keyCardId.value },
          })
        : await api.request<DeckDetail>('/api/decks', { method: 'POST', body })

      savedDeckId.value = deck.id
      return deck
    } catch (caught) {
      error.value =
        caught instanceof ApiRequestError ? caught.message : 'Unable to save this deck.'
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    format,
    name,
    keyCardId,
    entries,
    sections,
    counts,
    breakdown,
    rules,
    validation,
    savedDeckId,
    saving,
    error,
    copiesOf,
    addCard,
    removeCard,
    increaseQuantity,
    decreaseQuantity,
    clear,
    rename,
    setFormat,
    loadFromDeck,
    save,
  }
}

/**
 * Smart deck generation, including the staged progress shown while waiting.
 * The stages reflect real request progress; they never gate the result.
 */
export function useDeckGenerator() {
  const api = useApi()

  const stages = [
    'Analyzing key card',
    'Finding archetype support',
    'Evaluating card synergy',
    'Optimizing deck composition',
  ]

  const activeStage = ref(0)
  const generating = ref(false)
  const error = ref<string | null>(null)
  const result = ref<DeckRecommendation | null>(null)

  async function generate(format: DeckFormat, keyCardId: number): Promise<DeckRecommendation | null> {
    generating.value = true
    error.value = null
    result.value = null
    activeStage.value = 0

    // Advances the visible stage while the request is in flight. Cleared as
    // soon as the response arrives, so it never delays the result.
    const timer = setInterval(() => {
      if (activeStage.value < stages.length - 1) activeStage.value += 1
    }, 600)

    try {
      const recommendation = await api.request<DeckRecommendation>('/api/decks/generate', {
        method: 'POST',
        body: { format, keyCardId },
      })
      result.value = recommendation
      activeStage.value = stages.length - 1
      return recommendation
    } catch (caught) {
      error.value =
        caught instanceof ApiRequestError
          ? caught.message
          : 'Something went wrong while generating the deck.'
      return null
    } finally {
      clearInterval(timer)
      generating.value = false
    }
  }

  return { stages, activeStage, generating, error, result, generate }
}

/**
 * Loads a shared deck by its public id.
 */
export function useSharedDeck(id: string) {
  const api = useApi()
  const deck = ref<DeckDetail | null>(null)
  const pending = ref(true)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    pending.value = true
    error.value = null
    try {
      deck.value = await api.request<DeckDetail>(`/api/decks/${id}`)
    } catch (caught) {
      deck.value = null
      error.value =
        caught instanceof ApiRequestError ? caught.message : 'Deck no longer exists.'
    } finally {
      pending.value = false
    }
  }

  async function clone(): Promise<DeckDetail | null> {
    try {
      return await api.request<DeckDetail>(`/api/decks/${id}/clone`, { method: 'POST' })
    } catch {
      return null
    }
  }

  return { deck, pending, error, load, clone }
}
