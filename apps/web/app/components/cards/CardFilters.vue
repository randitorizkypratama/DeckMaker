<script setup lang="ts">
import type { FilterMetadata } from '@dueldex/shared'
import type { CardFilters } from '~/composables/useCards'

const props = defineProps<{
  filters: CardFilters
  metadata: FilterMetadata | null
  hasFilters: boolean
}>()

const emit = defineEmits<{
  change: [filters: Partial<CardFilters>]
  clear: []
}>()

const ANY = '__any__'

function toOptions(values: readonly string[], anyLabel: string) {
  return [
    { label: anyLabel, value: ANY },
    ...values.map((value) => ({ label: value, value })),
  ]
}

const typeOptions = computed(() => toOptions(props.metadata?.types ?? [], 'Any type'))
const attributeOptions = computed(() =>
  toOptions(props.metadata?.attributes ?? [], 'Any attribute'),
)
const archetypeOptions = computed(() =>
  toOptions(props.metadata?.archetypes ?? [], 'Any archetype'),
)
const levelOptions = computed(() => [
  { label: 'Any level', value: ANY },
  ...(props.metadata?.levels ?? []).map((level) => ({
    label: `Level ${level}`,
    value: String(level),
  })),
])
const raceOptions = computed(() => toOptions(props.metadata?.races ?? [], 'Any race'))

function update(key: keyof CardFilters, value: string): void {
  if (key === 'level') {
    emit('change', { level: value === ANY ? undefined : Number(value) })
    return
  }
  if (key === 'atk' || key === 'def') {
    const num = value.trim() === '' ? undefined : Number(value)
    if (num !== undefined && (Number.isNaN(num) || num < 0)) return
    emit('change', { [key]: num } as any)
    return
  }
  emit('change', { [key]: value === ANY ? '' : value } as Partial<CardFilters>)
}

function activeCount(key: string): boolean {
  const v = (props.filters as any)[key]
  if (v === undefined || v === '' || v === null) return false
  return true
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Type -->
    <div>
      <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
        <UIcon name="i-lucide-layers" class="size-3.5" />
        Card Type
      </label>
      <select
        :value="filters.type || ANY"
        class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none"
        @change="update('type', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Attribute -->
    <div>
      <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
        <UIcon name="i-lucide-sparkles" class="size-3.5" />
        Attribute
      </label>
      <select
        :value="filters.attribute || ANY"
        class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none"
        @change="update('attribute', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in attributeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Level / Rank -->
    <div>
      <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
        <UIcon name="i-lucide-star" class="size-3.5" />
        Level / Rank
      </label>
      <select
        :value="filters.level === undefined ? ANY : String(filters.level)"
        class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none"
        @change="update('level', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Archetype -->
    <div>
      <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
        <UIcon name="i-lucide-bookmark" class="size-3.5" />
        Archetype
      </label>
      <select
        :value="filters.archetype || ANY"
        class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none"
        @change="update('archetype', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in archetypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Race -->
    <div>
      <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
        <UIcon name="i-lucide-swords" class="size-3.5" />
        Race
      </label>
      <select
        :value="filters.race || ANY"
        class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none"
        @change="update('race', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in raceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- ATK / DEF -->
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <UIcon name="i-lucide-sword" class="size-3.5" />
          ATK
        </label>
        <input
          :value="filters.atk === undefined ? '' : String(filters.atk)"
          type="number"
          placeholder="e.g. 2500"
          min="0"
          class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 transition-colors focus:border-primary-500 focus:outline-none"
          @change="update('atk', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-400">
          <UIcon name="i-lucide-shield" class="size-3.5" />
          DEF
        </label>
        <input
          :value="filters.def === undefined ? '' : String(filters.def)"
          type="number"
          placeholder="e.g. 2100"
          min="0"
          class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 transition-colors focus:border-primary-500 focus:outline-none"
          @change="update('def', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Clear -->
    <button
      v-if="hasFilters"
      class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 py-2 text-xs text-neutral-400 transition-colors hover:border-red-800 hover:bg-red-950/20 hover:text-red-400"
      @click="emit('clear')"
    >
      <UIcon name="i-lucide-x" class="size-3.5" />
      Clear all filters
    </button>
  </div>
</template>
