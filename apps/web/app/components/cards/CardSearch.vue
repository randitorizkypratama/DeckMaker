<script setup lang="ts">
/**
 * Debounced search input so typing does not fire a request per keystroke.
 */
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [value: string]
}>()

const local = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.modelValue,
  (value) => {
    if (value !== local.value) local.value = value
  },
)

function onInput(value: string): void {
  local.value = value
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    emit('update:modelValue', value)
    emit('search', value)
  }, 350)
}

function submit(): void {
  if (timer) clearTimeout(timer)
  emit('update:modelValue', local.value)
  emit('search', local.value)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <form role="search" @submit.prevent="submit">
    <UInput
      :model-value="local"
      icon="i-lucide-search"
      placeholder="Search cards by name..."
      size="lg"
      class="w-full"
      aria-label="Search cards by name"
      @update:model-value="onInput(String($event))"
    />
  </form>
</template>
