<script setup lang="ts">
/**
 * Page navigation with a condensed window of page numbers so the control
 * stays usable on narrow screens.
 */
const props = defineProps<{
  page: number
  totalPages: number
}>()

const emit = defineEmits<{ change: [page: number] }>()

const pages = computed<(number | 'gap')[]>(() => {
  const total = props.totalPages
  const current = props.page
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const result: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) result.push('gap')
  for (let page = start; page <= end; page += 1) result.push(page)
  if (end < total - 1) result.push('gap')
  result.push(total)

  return result
})
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex flex-wrap items-center justify-center gap-1"
    aria-label="Pagination"
  >
    <UButton
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="ghost"
      size="sm"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="emit('change', page - 1)"
    />

    <template v-for="(item, index) in pages" :key="`${item}-${index}`">
      <span v-if="item === 'gap'" class="px-1 text-sm text-neutral-600">...</span>
      <UButton
        v-else
        :color="item === page ? 'primary' : 'neutral'"
        :variant="item === page ? 'solid' : 'ghost'"
        size="sm"
        class="min-w-9 justify-center"
        :aria-current="item === page ? 'page' : undefined"
        @click="emit('change', item)"
      >
        {{ item }}
      </UButton>
    </template>

    <UButton
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="ghost"
      size="sm"
      :disabled="page >= totalPages"
      aria-label="Next page"
      @click="emit('change', page + 1)"
    />
  </nav>
</template>
