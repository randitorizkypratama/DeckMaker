<script setup lang="ts">
/**
 * Favorite toggle. Purely presentational - favorite state is owned by
 * the useFavorites composable.
 */
const props = defineProps<{
  active: boolean
  label?: string
}>()

const emit = defineEmits<{ toggle: [] }>()

const accessibleLabel = computed(() =>
  props.active ? 'Remove from favorites' : 'Add to favorites',
)

function onClick(event: MouseEvent): void {
  // Stops the click from also triggering an enclosing card link.
  event.preventDefault()
  event.stopPropagation()
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    :aria-label="accessibleLabel"
    :aria-pressed="active"
    :title="accessibleLabel"
    class="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900/90 px-2 py-1 text-xs text-neutral-300 transition-colors hover:border-ink-500 hover:text-neutral-100"
    @click="onClick"
  >
    <UIcon
      :name="active ? 'i-lucide-heart' : 'i-lucide-heart-off'"
      class="size-3.5"
      :class="active ? 'text-rose-400' : 'text-neutral-500'"
    />
    <span v-if="label">{{ label }}</span>
  </button>
</template>
