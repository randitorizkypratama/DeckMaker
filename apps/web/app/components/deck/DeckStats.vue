<script setup lang="ts">
import type { DeckFormatRules, DeckStats } from '@dueldex/shared'

const props = defineProps<{
  counts: { main: number; extra: number; side: number }
  breakdown: { monster: number; spell: number; trap: number }
  rules: DeckFormatRules
  stats?: DeckStats
  issues?: string[]
}>()

const progress = computed(() => {
  const ratio = props.rules.mainDeckMin > 0 ? props.counts.main / props.rules.mainDeckMin : 0
  return Math.min(100, Math.round(ratio * 100))
})

const mainOk = computed(() => props.counts.main >= props.rules.mainDeckMin && props.counts.main <= props.rules.mainDeckMax)

const sortedArchetypes = computed(() => {
  if (!props.stats?.archetypeBreakdown) return []
  return Object.entries(props.stats.archetypeBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5)
})

const levelEntries = computed(() => {
  if (!props.stats?.levelCurve) return []
  return Object.entries(props.stats.levelCurve).filter(([k]) => k !== '-').sort((a, b) => Number(a[0]) - Number(b[0]))
})

const atkEntries = computed(() => {
  if (!props.stats?.atkHistogram) return []
  const order = ['0-1000','1000-2000','2000-3000','3000+']
  return Object.entries(props.stats.atkHistogram).sort((a,b)=> order.indexOf(a[0]) - order.indexOf(b[0]))
})

const maxLevel = computed(() => Math.max(...levelEntries.value.map(([, c]) => c), 1))
const maxAtk = computed(() => Math.max(...atkEntries.value.map(([, c]) => c), 1))

const totalCards = computed(() => props.breakdown.monster + props.breakdown.spell + props.breakdown.trap)
</script>

<template>
  <div class="rounded-xl border border-ink-800 bg-ink-900 p-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-neutral-200">
        <UIcon name="i-lucide-bar-chart-3" class="size-4 text-primary-400" />
        Deck Stats
      </h2>
      <span class="rounded-md bg-ink-800 px-2 py-0.5 text-[10px] text-neutral-500">{{ rules.label }}</span>
    </div>

    <!-- Progress bar -->
    <div class="mt-4">
      <div class="flex items-baseline justify-between text-sm">
        <span class="text-neutral-400">Main Deck</span>
        <span class="font-semibold tabular-nums" :class="mainOk ? 'text-emerald-400' : 'text-amber-400'">
          {{ counts.main }} / {{ rules.mainDeckMin }}
        </span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
        <div class="h-full rounded-full transition-all duration-500" :class="mainOk ? 'bg-emerald-500' : 'bg-amber-500'" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <!-- M/S/T breakdown -->
    <div class="mt-4 grid grid-cols-3 gap-2">
      <div class="rounded-lg bg-ink-850 p-2.5 text-center">
        <div class="text-lg font-bold text-amber-400">{{ breakdown.monster }}</div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-500">Monster</div>
      </div>
      <div class="rounded-lg bg-ink-850 p-2.5 text-center">
        <div class="text-lg font-bold text-blue-400">{{ breakdown.spell }}</div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-500">Spell</div>
      </div>
      <div class="rounded-lg bg-ink-850 p-2.5 text-center">
        <div class="text-lg font-bold text-rose-400">{{ breakdown.trap }}</div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-500">Trap</div>
      </div>
    </div>

    <!-- Extra / Side -->
    <div v-if="rules.hasExtraDeck || rules.hasSideDeck" class="mt-3 flex gap-3 text-xs">
      <div v-if="rules.hasExtraDeck" class="flex items-center gap-1.5">
        <span class="text-neutral-500">Extra:</span>
        <span class="font-medium text-blue-400">{{ counts.extra }}</span>
        <span class="text-neutral-600">/{{ rules.extraDeckMax }}</span>
      </div>
      <div v-if="rules.hasSideDeck" class="flex items-center gap-1.5">
        <span class="text-neutral-500">Side:</span>
        <span class="font-medium text-purple-400">{{ counts.side }}</span>
        <span class="text-neutral-600">/{{ rules.sideDeckMax }}</span>
      </div>
    </div>

    <!-- Analysis -->
    <div v-if="stats" class="mt-4 space-y-3 border-t border-ink-800 pt-4">
      <!-- Avg stats -->
      <div v-if="stats.avgLevel !== undefined || stats.avgAtk !== undefined" class="flex gap-2">
        <span v-if="stats.avgLevel !== undefined" class="rounded-md bg-ink-850 px-2 py-1 text-xs text-neutral-300">
          Avg Lv <b class="text-neutral-100">{{ stats.avgLevel }}</b>
        </span>
        <span v-if="stats.avgAtk !== undefined" class="rounded-md bg-ink-850 px-2 py-1 text-xs text-neutral-300">
          Avg ATK <b class="text-neutral-100">{{ stats.avgAtk }}</b>
        </span>
      </div>

      <!-- Level curve -->
      <div v-if="levelEntries.length">
        <p class="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">Level Curve</p>
        <div class="flex items-end gap-1">
          <div v-for="[lvl, cnt] in levelEntries" :key="lvl" class="flex flex-1 flex-col items-center">
            <div class="w-full rounded-t bg-primary-500 transition-all duration-300" :style="{height: `${Math.max(4, (cnt / maxLevel) * 40)}px`}" :title="`Level ${lvl}: ${cnt}`" />
            <span class="mt-1 text-[10px] text-neutral-500">{{ lvl }}</span>
          </div>
        </div>
      </div>

      <!-- ATK histogram -->
      <div v-if="atkEntries.length">
        <p class="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">ATK Distribution</p>
        <div class="space-y-1">
          <div v-for="[bucket, cnt] in atkEntries" :key="bucket" class="flex items-center gap-2 text-xs">
            <span class="w-16 text-neutral-500">{{ bucket }}</span>
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
              <div class="h-full rounded-full bg-emerald-500 transition-all duration-300" :style="{width: `${(cnt / maxAtk) * 100}%`}"></div>
            </div>
            <span class="w-5 text-right tabular-nums text-neutral-400">{{ cnt }}</span>
          </div>
        </div>
      </div>

      <!-- Top archetypes -->
      <div v-if="sortedArchetypes.length">
        <p class="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">Top Archetypes</p>
        <div class="space-y-1">
          <div v-for="([arch, cnt], i) in sortedArchetypes" :key="arch" class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 truncate text-neutral-400">
              <span class="size-1.5 rounded-full" :class="['bg-primary-400','bg-blue-400','bg-amber-400','bg-rose-400','bg-purple-400'][i]" />
              {{ arch }}
            </span>
            <span class="tabular-nums text-neutral-300">{{ cnt }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Issues -->
    <div v-if="issues?.length" class="mt-4 space-y-1.5 border-t border-ink-800 pt-4">
      <div v-for="issue in issues" :key="issue" class="flex gap-1.5 text-xs leading-relaxed text-amber-400">
        <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-3 shrink-0" />
        <span>{{ issue }}</span>
      </div>
    </div>
  </div>
</template>
