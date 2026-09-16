<script setup lang="ts">
useHead({ title: 'Register - DuelDex' })

const auth = useAuth()
const router = useRouter()

onMounted(() => {
  auth.loadFromStorage()
  if (auth.isAuthenticated.value) router.push('/cards')
})

const username = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)

async function onRegister() {
  const ok = await auth.register(username.value, email.value, password.value)
  if (ok) await navigateTo('/cards')
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-12 sm:px-6">
    <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
      <h1 class="text-xl font-semibold text-neutral-50">Create account</h1>
      <p class="mt-1 text-sm text-neutral-400">Your decks and favorites will be saved to SQLite.</p>

      <form class="mt-6 space-y-4" @submit.prevent="onRegister">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-neutral-300">Username</label>
          <UInput v-model="username" placeholder="duelist42" required autocomplete="username" />
          <p class="mt-1 text-xs text-neutral-500">3-20 chars, letters/numbers/underscore only</p>
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-neutral-300">Email</label>
          <UInput v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-neutral-300">Password</label>
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            required
            autocomplete="new-password"
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
          Create account
        </UButton>
      </form>

      <p class="mt-6 text-center text-sm text-neutral-400">
        Already have an account?
        <NuxtLink to="/login" class="text-accent-400 hover:text-accent-300">Login</NuxtLink>
      </p>
    </div>
  </div>
</template>
