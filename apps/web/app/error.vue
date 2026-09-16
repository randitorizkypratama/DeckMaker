<script setup lang="ts">
/**
 * Global error boundary. Ensures a failed route never shows a blank screen.
 */
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error.statusCode === 404)

useHead({ title: 'Something went wrong - DuelDex' })
</script>

<template>
  <UApp>
    <div class="flex min-h-screen flex-col bg-ink-950">
      <LayoutAppHeader />
      <main class="flex flex-1 items-center justify-center px-4 py-16">
        <div class="max-w-md text-center">
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-accent-500">
            Error {{ error.statusCode }}
          </p>
          <h1 class="mt-3 text-2xl font-semibold text-neutral-50">
            {{ isNotFound ? 'Page not found' : 'Something went wrong' }}
          </h1>
          <p class="mt-2 text-sm text-neutral-400">
            {{
              isNotFound
                ? 'The page you are looking for does not exist or has moved.'
                : 'An unexpected error occurred. Please try again.'
            }}
          </p>
          <div class="mt-6 flex justify-center gap-2">
            <UButton to="/" color="primary">Go home</UButton>
            <UButton to="/cards" color="neutral" variant="outline">Explore cards</UButton>
          </div>
        </div>
      </main>
      <LayoutAppFooter />
    </div>
  </UApp>
</template>
