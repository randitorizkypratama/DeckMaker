<script setup lang="ts">
import type { Card } from '@dueldex/shared'

/**
 * Card artwork with a fixed aspect ratio to prevent layout shift, lazy
 * loading, and a graceful fallback when an image fails to load.
 */
const props = withDefaults(
  defineProps<{
    card: Card
    size?: 'small' | 'large'
    eager?: boolean
  }>(),
  { size: 'small', eager: false },
)

const failed = ref(false)

const source = computed(() => {
  const image = props.card.cardImages[0]
  if (!image) return null
  return props.size === 'large' ? image.imageUrl : image.imageUrlSmall
})
</script>

<template>
  <div class="card-aspect relative w-full overflow-hidden rounded bg-ink-850">
    <img
      v-if="source && !failed"
      :src="source"
      :alt="card.name"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      class="size-full object-cover"
      @error="failed = true"
    />
    <div
      v-else
      class="flex size-full items-center justify-center p-2 text-center"
      role="img"
      :aria-label="card.name"
    >
      <span class="text-xs text-neutral-500">{{ card.name }}</span>
    </div>
  </div>
</template>
