<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mt-auto border-t border-ink-800 bg-ink-950">
    <div
      class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p>DuelDex &copy; {{ year }} - Card explorer and smart deck builder.</p>
      <p>
        Card data from
        <a
          href="https://ygoprodeck.com/api-guide/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-neutral-400 underline decoration-ink-600 underline-offset-2 hover:text-neutral-200"
        >
          YGOPRODeck
        </a>
        . Yu-Gi-Oh! is a trademark of Konami. This is an unofficial fan project.
      </p>
    </div>
  </footer>
</template>
