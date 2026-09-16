<script setup lang="ts">
import type { Card, DeckFormatRules } from '@dueldex/shared'

/**
 * Deck title bar: inline rename plus the save and share actions.
 */
const name = defineModel<string>('name', { required: true })

const props = defineProps<{
  rules: DeckFormatRules
  keyCard?: Card | null
  saving?: boolean
  savedId?: string | null
  canSave?: boolean
}>()

const emit = defineEmits<{
  save: []
  share: []
  clear: []
}>()

const editing = ref(false)
const draft = ref(name.value)

function startEditing(): void {
  draft.value = name.value
  editing.value = true
}

function commit(): void {
  const trimmed = draft.value.trim()
  if (trimmed.length > 0) name.value = trimmed
  editing.value = false
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0">
      <div v-if="editing" class="flex items-center gap-2">
        <UInput
          v-model="draft"
          size="lg"
          autofocus
          :maxlength="80"
          class="max-w-xs"
          aria-label="Deck name"
          @keyup.enter="commit"
          @keyup.esc="editing = false"
        />
        <UButton icon="i-lucide-check" color="primary" size="sm" @click="commit" />
      </div>
      <button
        v-else
        type="button"
        class="group flex items-center gap-2 text-left"
        @click="startEditing"
      >
        <h1 class="truncate text-2xl font-semibold tracking-tight text-neutral-50">
          {{ name }}
        </h1>
        <UIcon
          name="i-lucide-pencil"
          class="size-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-400"
        />
      </button>

      <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
        <span>{{ rules.label }}</span>
        <template v-if="keyCard">
          <span aria-hidden="true">&middot;</span>
          <span class="truncate">
            Built around
            <NuxtLink
              :to="`/cards/${keyCard.id}`"
              class="text-neutral-300 hover:text-accent-400"
            >
              {{ keyCard.name }}
            </NuxtLink>
          </span>
        </template>
      </div>
    </div>

    <div class="flex shrink-0 flex-wrap gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        @click="emit('clear')"
      >
        Clear
      </UButton>
      <UButton
        v-if="props.savedId"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-share-2"
        @click="emit('share')"
      >
        Share
      </UButton>
      <UButton
        color="primary"
        size="sm"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="!canSave"
        @click="emit('save')"
      >
        Save Deck
      </UButton>
    </div>
  </div>
</template>
