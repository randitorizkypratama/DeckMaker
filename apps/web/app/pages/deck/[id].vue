<script setup lang="ts">
import type { DeckSectionName, Combo, HandSimResult } from '@dueldex/shared'
import { getFormatRules } from '@dueldex/shared'

const route = useRoute()
const deckId = computed(() => String(route.params.id))

const { deck, pending, error, load, clone } = useSharedDeck(deckId.value)

const copied = ref(false)
const cloning = ref(false)

// Combo & Simulator
const combos = ref<Combo[]>([])
const combosPending = ref(false)
const showCombos = ref(false)

const simResult = ref<HandSimResult | null>(null)
const simPending = ref(false)
const showSim = ref(false)
const simTrials = ref(1000)
const simHandSize = ref(5)

useHead(() => ({
  title: deck.value ? `${deck.value.name} - DuelDex` : 'Deck - DuelDex',
}))

const rules = computed(() => (deck.value ? getFormatRules(deck.value.format) : null))

const banlistIssues = computed(() => {
  if (!deck.value) return []
  const issues: string[] = []
  const seen = new Map<number, { name: string; copies: number; status: string; limit: number }>()
  for (const entry of deck.value.cards) {
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
  return issues
})

function sectionEntries(section: DeckSectionName) {
  return (deck.value?.cards ?? []).filter((entry) => entry.section === section)
}

function sectionCount(section: DeckSectionName): number {
  return sectionEntries(section).reduce((total, entry) => total + entry.quantity, 0)
}

async function copyDeck(): Promise<void> {
  if (!deck.value || !import.meta.client) return

  const lines: string[] = [deck.value.name, getFormatRules(deck.value.format).label, '']
  for (const section of ['main', 'extra', 'side'] as DeckSectionName[]) {
    const entries = sectionEntries(section)
    if (entries.length === 0) continue
    const title = section === 'main' ? 'Main Deck' : section === 'extra' ? 'Extra Deck' : 'Side Deck'
    lines.push(`${title} (${sectionCount(section)})`)
    for (const entry of entries) lines.push(`${entry.quantity}x ${entry.card.name}`)
    lines.push('')
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n').trim())
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { copied.value = false }
}

async function cloneDeck(): Promise<void> {
  cloning.value = true
  const copy = await clone()
  cloning.value = false
  if (copy) await navigateTo(`/deck/${copy.id}`)
}

function toggleCombos() {
  if (showCombos.value) { showCombos.value = false; return }
  loadCombos()
}

function getCardRole(type: string, index: number, total: number): string {
  if (type === 'search') return index === 0 ? 'Searcher' : 'Target'
  if (type === 'extender') return index === 0 ? 'Extender' : 'Payoff'
  if (type === 'boss') return index === 0 ? 'Boss' : 'Protection'
  if (type === 'protection') return index === 0 ? 'Card' : 'Guard'
  if (type === 'engine') return index === 0 ? 'Engine' : 'Piece'
  return 'Card'
}

async function loadCombos() {
  if (!deck.value) return
  showCombos.value = true
  if (combos.value.length > 0) return
  combosPending.value = true
  try {
    const api = useApi()
    const res = await api.request<{ combos: Combo[] }>(`/api/decks/${deck.value.id}/combos?max=10`)
    combos.value = res.combos
  } catch {} finally { combosPending.value = false }
}

function toggleSim() {
  if (showSim.value) { showSim.value = false; return }
  loadSim()
}

async function loadSim() {
  if (!deck.value) return
  showSim.value = true
  simPending.value = true
  try {
    const api = useApi()
    simResult.value = await api.request<HandSimResult>(`/api/decks/${deck.value.id}/simulate?trials=${simTrials.value}&handSize=${simHandSize.value}`)
  } catch {} finally { simPending.value = false }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <CommonLoadingState v-if="pending" label="Loading deck..." />

    <CommonErrorState
      v-else-if="error || !deck || !rules"
      title="Deck not found"
      :message="error ?? 'This deck no longer exists or the link is invalid.'"
      retry-label="Browse cards"
      @retry="navigateTo('/cards')"
    />

    <div v-else>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
        class="mb-4"
        @click="$router.back()"
      >
        Back
      </UButton>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold tracking-tight text-neutral-50">{{ deck.name }}</h1>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
            <span>{{ rules.label }}</span>
            <template v-if="deck.keyCard">
              <span aria-hidden="true">&middot;</span>
              <span>Built around <NuxtLink :to="`/cards/${deck.keyCard.id}`" class="text-neutral-300 hover:text-accent-400">{{ deck.keyCard.name }}</NuxtLink></span>
            </template>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap gap-2">
          <UButton color="neutral" variant="outline" size="sm" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyDeck">{{ copied ? 'Copied' : 'Copy deck' }}</UButton>
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-git-fork" :loading="cloning" @click="cloneDeck">Clone</UButton>
          <UButton color="primary" size="sm" icon="i-lucide-pencil" :to="{ path: '/deck/new', query: { editId: deck.id } }">Edit deck</UButton>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div class="lg:order-2">
          <DeckStats
            :counts="{ main: deck.stats.mainCount, extra: deck.stats.extraCount, side: deck.stats.sideCount }"
            :breakdown="{ monster: deck.stats.monsterCount, spell: deck.stats.spellCount, trap: deck.stats.trapCount }"
            :stats="deck.stats"
            :rules="rules"
            :issues="banlistIssues.length > 0 ? banlistIssues : undefined"
          />

          <div v-if="deck.keyCard" class="mt-4">
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Key card</p>
            <NuxtLink :to="`/cards/${deck.keyCard.id}`" class="block max-w-[200px]">
              <CardsCardImage :card="deck.keyCard" size="large" />
            </NuxtLink>
          </div>

          <!-- Combo & Simulator buttons -->
          <div class="mt-4 space-y-2">
            <UButton color="secondary" variant="outline" size="sm" icon="i-lucide-zap" block @click="toggleCombos">
              {{ showCombos ? 'Hide' : 'Find' }} Combos
            </UButton>
            <UButton color="secondary" variant="outline" size="sm" icon="i-lucide-dice-5" block @click="toggleSim">
              {{ showSim ? 'Hide' : 'Simulate' }} Opening Hand
            </UButton>
          </div>

          <!-- Combos -->
          <div v-if="showCombos" class="mt-4 rounded-lg border border-ink-800 bg-ink-900 p-4">
            <h3 class="mb-1 text-sm font-semibold text-neutral-200">Combo Finder</h3>
            <p class="mb-3 text-[11px] text-neutral-500">Synergy chains between cards in your deck</p>
            <CommonLoadingState v-if="combosPending" label="Analyzing combos..." />
            <div v-else-if="combos.length === 0" class="text-sm text-neutral-500">No significant combos found in this deck.</div>
            <div v-else class="space-y-3">
              <div v-for="(c, i) in combos" :key="i" class="rounded-lg border border-ink-800/50 bg-ink-950 p-3">
                <!-- Header: type badge + score bar -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <UBadge :color="c.type==='boss'?'error':c.type==='search'?'primary':c.type==='extender'?'warning':c.type==='protection'?'success':'info'" size="xs">
                      {{ c.type }}
                    </UBadge>
                    <span class="text-xs text-neutral-400">{{ c.reason }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <div class="h-1.5 w-16 overflow-hidden rounded-full bg-ink-800">
                      <div class="h-full rounded-full bg-primary-500" :style="{ width: `${c.score}%` }" />
                    </div>
                    <span class="text-[10px] tabular-nums text-neutral-500">{{ c.score }}</span>
                  </div>
                </div>

                <!-- Card chain -->
                <div class="mt-3 flex flex-wrap items-center gap-1">
                  <template v-for="(card, j) in c.cards" :key="card.cardId">
                    <!-- Arrow between cards -->
                    <div v-if="j > 0" class="flex items-center px-1">
                      <UIcon name="i-lucide-arrow-right" class="size-3 text-neutral-600" />
                    </div>
                    <!-- Card chip -->
                    <NuxtLink
                      :to="`/cards/${card.cardId}`"
                      class="group inline-flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-850 px-2 py-1 text-xs transition-colors hover:border-primary-700 hover:bg-ink-800"
                    >
                      <span class="text-neutral-300 group-hover:text-primary-400">{{ card.name }}</span>
                      <span class="rounded bg-ink-800 px-1 py-0.5 text-[9px] text-neutral-500">{{ getCardRole(c.type, j, c.cards.length) }}</span>
                    </NuxtLink>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Simulator -->
          <div v-if="showSim" class="mt-4 rounded-lg border border-ink-800 bg-ink-900 p-4">
            <h3 class="mb-3 text-sm font-semibold text-neutral-200">Opening Hand Simulator</h3>
            <div class="mb-3 flex flex-wrap gap-2">
              <UInput v-model.number="simHandSize" type="number" :min="1" :max="7" class="w-20" placeholder="Hand" />
              <UInput v-model.number="simTrials" type="number" :min="100" :max="5000" class="w-28" placeholder="Trials" />
              <UButton color="primary" size="xs" :loading="simPending" @click="loadSim">Run</UButton>
            </div>
            <CommonLoadingState v-if="simPending" label="Simulating..." />
            <div v-else-if="simResult" class="space-y-3">
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="rounded bg-ink-800 p-2">
                  <div class="text-lg font-bold text-emerald-400">{{ simResult.monsterPct }}%</div>
                  <div class="text-[10px] text-neutral-500">Monster</div>
                </div>
                <div class="rounded bg-ink-800 p-2">
                  <div class="text-lg font-bold text-blue-400">{{ simResult.spellPct }}%</div>
                  <div class="text-[10px] text-neutral-500">Spell</div>
                </div>
                <div class="rounded bg-ink-800 p-2">
                  <div class="text-lg font-bold text-amber-400">{{ simResult.trapPct }}%</div>
                  <div class="text-[10px] text-neutral-500">Trap</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-center">
                <div class="rounded bg-ink-800 p-2">
                  <div class="text-lg font-bold text-red-400">{{ simResult.brickRate }}%</div>
                  <div class="text-[10px] text-neutral-500">Brick</div>
                </div>
                <div class="rounded bg-ink-800 p-2">
                  <div class="text-lg font-bold text-neutral-300">{{ simResult.avgHandAtk }}</div>
                  <div class="text-[10px] text-neutral-500">Avg ATK</div>
                </div>
              </div>
              <p class="text-[10px] text-neutral-600">{{ simResult.trials }} trials, {{ simResult.deckSize }} cards</p>
            </div>
          </div>

        </div>

        <div class="space-y-6 lg:order-1">
          <DeckSection
            title="Main Deck"
            section="main"
            :entries="sectionEntries('main')"
            :count="sectionCount('main')"
            :limit="rules.mainDeckMax"
            :max-copies="rules.maxCopiesPerCard"
            :breakdown="{ monster: deck.stats.monsterCount, spell: deck.stats.spellCount, trap: deck.stats.trapCount }"
            readonly
          />
          <DeckSection
            v-if="rules.hasExtraDeck && sectionCount('extra') > 0"
            title="Extra Deck"
            section="extra"
            :entries="sectionEntries('extra')"
            :count="sectionCount('extra')"
            :limit="rules.extraDeckMax"
            :max-copies="rules.maxCopiesPerCard"
            readonly
          />
          <DeckSection
            v-if="rules.hasSideDeck && sectionCount('side') > 0"
            title="Side Deck"
            section="side"
            :entries="sectionEntries('side')"
            :count="sectionCount('side')"
            :limit="rules.sideDeckMax"
            :max-copies="rules.maxCopiesPerCard"
            readonly
          />

        </div>
      </div>
    </div>
  </div>
</template>
