<script setup lang="ts">
/**
 * Error state with an optional retry action. Never leaves the user with a
 * blank screen when a request fails.
 */
defineProps<{
  title?: string
  message?: string
  retryLabel?: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-lg border border-ink-700 bg-ink-900 px-6 py-14 text-center"
  >
    <div class="flex size-10 items-center justify-center rounded-full bg-ink-800">
      <UIcon name="i-lucide-triangle-alert" class="size-5 text-amber-400" />
    </div>
    <h3 class="text-base font-medium text-neutral-100">
      {{ title ?? 'Something went wrong' }}
    </h3>
    <p class="max-w-md text-sm text-neutral-400">
      {{ message ?? 'Please try again in a moment.' }}
    </p>
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      class="mt-1"
      @click="emit('retry')"
    >
      {{ retryLabel ?? 'Try again' }}
    </UButton>
  </div>
</template>
