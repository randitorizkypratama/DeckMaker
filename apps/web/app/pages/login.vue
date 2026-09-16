<script setup lang="ts">
useHead({ title: 'Login - DuelDex' })

const auth = useAuth()
const router = useRouter()

onMounted(() => {
  auth.loadFromStorage()
  if (auth.isAuthenticated.value) router.push('/cards')
})

const username = ref('')
const password = ref('')
const showPassword = ref(false)

async function onLogin() {
  const ok = await auth.login(username.value, password.value)
  if (ok) await navigateTo('/cards')
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12 sm:px-6">
    <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
      <h1 class="text-xl font-semibold text-neutral-50">Welcome back</h1>
      <p class="mt-1 text-sm text-neutral-400">Login to manage your decks and favorites.</p>

      <form class="mt-6 space-y-4" @submit.prevent="onLogin">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-neutral-300">Username or email</label>
          <UInput v-model="username" placeholder="duelist42" required autocomplete="username" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-neutral-300">Password</label>
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
          <label class="mt-2 flex items-center gap-2 text-xs text-neutral-400">
            <input type="checkbox" v-model="showPassword" class="rounded"> Show password
          </label>
        </div>

        <UAlert
          v-if="auth.error.value"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="auth.error.value"
        />

        <UButton type="submit" color="primary" block :loading="auth.pending.value">
          Login
        </UButton>
      </form>

      <p class="mt-6 text-center text-sm text-neutral-400">
        Don't have an account?
        <NuxtLink to="/register" class="text-accent-400 hover:text-accent-300">Register</NuxtLink>
      </p>
    </div>
  </div>
</template>
