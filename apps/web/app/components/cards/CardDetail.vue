<script setup lang="ts">
import type { Card } from '@dueldex/shared'
import { cardKindOf } from '@dueldex/shared'

/**
 * Detail view for a single card. "Build Deck Around This" is the primary
 * call to action, as it is the product's key differentiator.
 */
const props = defineProps<{
  card: Card
  favorite: boolean
}>()

const emit = defineEmits<{
  toggleFavorite: []
  addToDeck: []
  buildDeck: []
}>()

const kind = computed(() => cardKindOf(props.card.type))

const levelLabel = computed(() => {
  if (typeof props.card.linkval === 'number') return 'Link Rating'
  return props.card.frameType.toLowerCase().includes('xyz') ? 'Rank' : 'Level'
})

const levelValue = computed(() => props.card.linkval ?? props.card.level)

/** Only shows rows that actually have a value. */
const banlistLabel = computed(() => {
  const b = props.card.banlist?.tcg
  if (!b) return null
  if (b === 'Forbidden') return 'Forbidden'
  if (b === 'Limited') return 'Limited (1)'
  if (b === 'Semi-Limited') return 'Semi-Limited (2)'
  return b
})

const attributes = computed(() => {
  const rows: { label: string; value: string }[] = [
    { label: 'Type', value: props.card.type },
    { label: 'Frame', value: props.card.frameType },
  ]
  if (props.card.attribute) rows.push({ label: 'Attribute', value: props.card.attribute })
  if (levelValue.value !== undefined) {
    rows.push({ label: levelLabel.value, value: String(levelValue.value) })
  }
  if (props.card.race) rows.push({ label: 'Race / Type', value: props.card.race })
  if (kind.value === 'monster') {
    rows.push({ label: 'ATK', value: props.card.atk?.toString() ?? '?' })
    if (typeof props.card.linkval !== 'number') {
      rows.push({ label: 'DEF', value: props.card.def?.toString() ?? '?' })
    }
  }
  if (props.card.archetype) {
    rows.push({ label: 'Archetype', value: props.card.archetype })
  }
  if (banlistLabel.value) {
    rows.push({ label: 'Banlist TCG', value: banlistLabel.value })
  }
  return rows
})
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[320px_1fr]">
    <div>
      <div class="mx-auto max-w-[320px] lg:mx-0">
        <CardsCardImage :card="card" size="large" eager />
      </div>

      <div class="mx-auto mt-4 flex max-w-[320px] flex-col gap-2 lg:mx-0">
        <UButton
          color="primary"
          size="lg"
          icon="i-lucide-sparkles"
          block
          @click="emit('buildDeck')"
        >
          Build Deck Around This
        </UButton>
        <div class="grid grid-cols-2 gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            @click="emit('addToDeck')"
          >
            Add to Deck
          </UButton>
          <UButton
            :color="favorite ? 'error' : 'neutral'"
            variant="outline"
            :icon="favorite ? 'i-lucide-heart' : 'i-lucide-heart-off'"
            @click="emit('toggleFavorite')"
          >
            {{ favorite ? 'Favorited' : 'Favorite' }}
          </UButton>
        </div>
      </div>
    </div>

    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl">
        {{ card.name }}
      </h1>
      <p class="mt-1 text-sm text-neutral-400">{{ card.type }}</p>

      <NuxtLink
        v-if="card.archetype"
        :to="`/cards?archetype=${encodeURIComponent(card.archetype)}`"
        class="mt-3 inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-xs text-neutral-300 hover:border-ink-500 hover:text-neutral-100"
      >
        <UIcon name="i-lucide-tag" class="size-3" />
        {{ card.archetype }}
      </NuxtLink>
      <span
        v-if="banlistLabel"
        class="ml-2 mt-3 inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
        :class="card.banlist?.tcg === 'Forbidden' ? 'bg-rose-900/50 text-rose-300 border border-rose-800' : card.banlist?.tcg === 'Limited' ? 'bg-amber-900/50 text-amber-300 border border-amber-800' : 'bg-yellow-900/30 text-yellow-300 border border-yellow-800'"
      >
        {{ banlistLabel }}
      </span>

      <dl class="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <div v-for="row in attributes" :key="row.label">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {{ row.label }}
          </dt>
          <dd class="mt-0.5 text-sm text-neutral-200">{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="card.linkmarkers?.length" class="mt-6">
        <h2 class="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Link Markers
        </h2>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="marker in card.linkmarkers"
            :key="marker"
            class="rounded bg-ink-800 px-2 py-0.5 text-xs text-neutral-300"
          >
            {{ marker }}
          </span>
        </div>
      </div>

      <div class="mt-6">
        <h2 class="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {{ kind === 'monster' && card.frameType === 'normal' ? 'Flavor Text' : 'Card Effect' }}
        </h2>
        <p
          class="mt-2 whitespace-pre-line rounded-lg border border-ink-700 bg-ink-900 p-4 text-sm leading-relaxed text-neutral-300"
        >
          {{ card.desc || 'No description available.' }}
        </p>
      </div>
    </div>
  </div>
</template>
