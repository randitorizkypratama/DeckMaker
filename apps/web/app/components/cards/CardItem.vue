<script setup lang="ts">
import type { Card } from '@dueldex/shared'
import { cardKindOf } from '@dueldex/shared'

const props = defineProps<{
  card: Card
  favorite: boolean
}>()

const emit = defineEmits<{
  toggleFavorite: [cardId: number]
  add: [card: Card]
}>()

const kind = computed(() => cardKindOf(props.card.type))

const levelLabel = computed(() => {
  if (typeof props.card.linkval === 'number') return `LINK-${props.card.linkval}`
  if (typeof props.card.level !== 'number') return null
  const isXyz = props.card.frameType.toLowerCase().includes('xyz')
  return `${isXyz ? 'Rank' : 'Lv'} ${props.card.level}`
})

const statLine = computed(() => {
  if (kind.value !== 'monster') return null
  const atk = typeof props.card.atk === 'number' ? props.card.atk : '?'
  if (typeof props.card.linkval === 'number') return `ATK ${atk}`
  const def = typeof props.card.def === 'number' ? props.card.def : '?'
  return `ATK ${atk} / DEF ${def}`
})

const kindColor = computed(() => {
  if (kind.value === 'spell') return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  if (kind.value === 'trap') return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
})

const banlistBadge = computed(() => {
  const ban = props.card.banlist?.tcg
  if (!ban) return null
  if (ban === 'Forbidden') return { label: 'Forbidden', symbol: '⊘', class: 'bg-red-600 text-white' }
  if (ban === 'Limited') return { label: 'Limited', symbol: '●', class: 'bg-amber-500 text-white' }
  if (ban === 'Semi-Limited') return { label: 'Semi', symbol: '●', class: 'bg-sky-500 text-white' }
  return null
})
</script>

<template>
  <article class="card-tile group relative flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-all duration-300 hover:-translate-y-1 hover:border-ink-600 hover:shadow-lg hover:shadow-primary-500/5">
    <!-- Image section -->
    <NuxtLink :to="`/cards/${card.id}`" class="block relative overflow-hidden" :aria-label="card.name">
      <CardsCardImage :card="card" />

      <!-- Gradient overlay on hover -->
      <div class="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <!-- Banlist badge -->
      <div v-if="banlistBadge" class="absolute top-2 right-2">
        <span
          :class="['inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-bold shadow-md', banlistBadge.class]"
          :title="banlistBadge.label"
        >
          {{ banlistBadge.symbol }}
        </span>
      </div>

      <!-- Quick view overlay -->
      <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
        <span class="rounded-lg bg-primary-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
          View Details
        </span>
      </div>
    </NuxtLink>

    <!-- Info section -->
    <div class="flex flex-1 flex-col gap-1.5 p-3">
      <NuxtLink
        :to="`/cards/${card.id}`"
        class="line-clamp-2 text-sm font-semibold leading-snug text-neutral-100 transition-colors hover:text-primary-400"
      >
        {{ card.name }}
      </NuxtLink>

      <p class="truncate text-xs text-neutral-500">{{ card.type }}</p>

      <!-- Badges row -->
      <div class="flex flex-wrap items-center gap-1">
        <span
          v-if="card.attribute"
          :class="['inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', kindColor]"
        >
          {{ card.attribute }}
        </span>
        <span
          v-if="levelLabel"
          class="inline-flex items-center rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400"
        >
          {{ levelLabel }}
        </span>
        <span
          v-if="card.race"
          class="inline-flex items-center rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-neutral-500"
        >
          {{ card.race }}
        </span>
      </div>

      <!-- Stats -->
      <p v-if="statLine" class="text-xs tabular-nums text-neutral-400">
        {{ statLine }}
      </p>

      <!-- Actions -->
      <div class="mt-auto flex items-center gap-1.5 pt-2">
        <CardsFavoriteButton
          :active="favorite"
          @toggle="emit('toggleFavorite', card.id)"
        />
        <UButton
          icon="i-lucide-plus"
          color="primary"
          variant="ghost"
          size="xs"
          :aria-label="`Add ${card.name} to deck`"
          @click="emit('add', card)"
        />
        <NuxtLink
          :to="`/cards/${card.id}`"
          class="ml-auto text-[10px] text-neutral-500 transition-colors hover:text-primary-400"
        >
          Details
        </NuxtLink>
      </div>
    </div>
  </article>
</template>
