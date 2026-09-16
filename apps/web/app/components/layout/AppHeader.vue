<script setup lang="ts">
/**
 * Primary navigation. Collapses to a menu button on mobile.
 */
const { count } = useFavorites()
const auth = useAuth()
const route = useRoute()
const mobileOpen = ref(false)

onMounted(() => {
  auth.loadFromStorage()
})

watch(() => route.fullPath, () => {
  mobileOpen.value = false
})

const links = computed(() => {
  const base = [
    { label: 'Cards', to: '/cards' },
    { label: 'Deck Builder', to: '/deck/new' },
    { label: 'My Decks', to: '/decks' },
    { label: 'Meta', to: '/meta' },
    { label: 'Favorites', to: '/favorites' },
  ]
  if (auth.user.value?.role === 'admin') {
    base.push({ label: 'Admin', to: '/admin' })
  }
  return base
})

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function toggleMobileMenu(): void {
  mobileOpen.value = !mobileOpen.value
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
      <NuxtLink to="/" class="flex items-center gap-2" aria-label="DuelDex home">
        <span
          class="flex size-7 items-center justify-center rounded bg-accent-500 text-sm font-bold text-ink-950"
        >
          D
        </span>
        <span class="text-base font-semibold tracking-tight text-neutral-100">
          DuelDex
        </span>
      </NuxtLink>

      <nav class="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="
            isActive(link.to)
              ? 'bg-ink-800 text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-100'
          "
        >
          {{ link.label }}
          <span v-if="link.to === '/favorites' && count > 0" class="ml-1 text-xs text-accent-400">
            {{ count }}
          </span>
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <template v-if="auth.isAuthenticated.value">
          <NuxtLink to="/profile" class="hidden items-center gap-2 sm:flex">
            <div class="size-7 overflow-hidden rounded-full border border-ink-700 bg-ink-800">
              <img v-if="auth.user.value?.avatar" :src="auth.user.value?.avatar" alt="avatar" class="h-full w-full object-cover" />
              <UIcon v-else name="i-lucide-user" class="size-4 m-1.5 text-neutral-500" />
            </div>
            <span class="text-sm text-neutral-300">{{ auth.user.value?.displayName || auth.user.value?.username }}</span>
          </NuxtLink>
          <UButton to="/profile" color="neutral" variant="ghost" size="sm" icon="i-lucide-user" class="hidden sm:inline-flex">Profile</UButton>
          <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-log-out" @click="auth.logout()">
            Logout
          </UButton>
        </template>
        <template v-else>
          <UButton to="/login" color="neutral" variant="ghost" size="sm">Login</UButton>
          <UButton to="/register" color="primary" size="sm" class="hidden sm:inline-flex">Register</UButton>
        </template>
        <UButton
          class="md:hidden"
          color="neutral"
          variant="ghost"
          size="sm"
          :icon="mobileOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="mobileOpen"
          @click="toggleMobileMenu"
        />
      </div>
    </div>

    <nav
      v-if="mobileOpen"
      class="border-t border-ink-800 px-4 pb-3 pt-2 md:hidden"
      aria-label="Mobile"
    >
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="block rounded-md px-3 py-2 text-sm"
        :class="
          isActive(link.to)
            ? 'bg-ink-800 text-neutral-100'
            : 'text-neutral-400 hover:text-neutral-100'
        "
      >
        {{ link.label }}
      </NuxtLink>
      <div class="mt-2 flex gap-2 border-t border-ink-800 pt-2">
        <template v-if="auth.isAuthenticated.value">
          <NuxtLink to="/profile" class="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300">
            <div class="size-6 overflow-hidden rounded-full border border-ink-700 bg-ink-800">
              <img v-if="auth.user.value?.avatar" :src="auth.user.value?.avatar" alt="avatar" class="h-full w-full object-cover" />
              <UIcon v-else name="i-lucide-user" class="size-4 text-neutral-500" />
            </div>
            {{ auth.user.value?.displayName || auth.user.value?.username }}
          </NuxtLink>
          <UButton to="/profile" color="neutral" variant="ghost" size="sm" block>Profile</UButton>
          <UButton color="neutral" variant="ghost" size="sm" @click="auth.logout()">Logout</UButton>
        </template>
        <template v-else>
          <UButton to="/login" color="neutral" variant="outline" size="sm" block>Login</UButton>
          <UButton to="/register" color="primary" size="sm" block>Register</UButton>
        </template>
      </div>
    </nav>
  </header>
</template>
