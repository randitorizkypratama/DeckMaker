<script setup lang="ts">
/**
 * Empty result placeholder with an optional call to action.
 */
defineProps<{
  title?: string
  message?: string
  icon?: string
  actionLabel?: string
}>()

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-700 bg-ink-900/60 px-6 py-14 text-center"
  >
    <div class="flex size-10 items-center justify-center rounded-full bg-ink-800">
      <UIcon :name="icon ?? 'i-lucide-search-x'" class="size-5 text-neutral-400" />
    </div>
    <h3 class="text-base font-medium text-neutral-100">
      {{ title ?? 'Nothing here yet' }}
    </h3>
    <p class="max-w-md text-sm text-neutral-400">
      {{ message ?? 'Try adjusting your search or filters.' }}
    </p>
    <UButton
      v-if="actionLabel"
      color="neutral"
      variant="outline"
      size="sm"
      class="mt-1"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </UButton>
  </div>
</template>
