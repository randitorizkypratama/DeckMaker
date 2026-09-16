<script setup lang="ts">
/**
 * Confirmation dialog for destructive actions such as clearing a deck.
 */
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{ confirm: [] }>()

function close(): void {
  open.value = false
}

function confirm(): void {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <p class="text-sm text-neutral-300">{{ message }}</p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" size="sm" @click="close">
          {{ cancelLabel ?? 'Cancel' }}
        </UButton>
        <UButton color="error" size="sm" @click="confirm">
          {{ confirmLabel ?? 'Confirm' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
