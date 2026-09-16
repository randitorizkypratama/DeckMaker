<script setup lang="ts">
import { convertToWebP } from '~/composables/useAuth'

useHead({ title: 'Profile - DuelDex' })

const auth = useAuth()
const api = useApi()

onMounted(() => {
  auth.loadFromStorage()
  if (!auth.isAuthenticated.value) {
    navigateTo('/login')
    return
  }
  auth.fetchMe()
})

const displayName = ref('')
const age = ref<number | undefined>(undefined)
const gender = ref<string>('')
const country = ref('')
const avatarPreview = ref<string | null>(null)
const avatarDataUrl = ref<string | null>(null)
const saving = ref(false)
const message = ref<string | null>(null)
const avatarError = ref<string | null>(null)
const uploading = ref(false)

watch(() => auth.user.value, (u) => {
  if (!u) return
  displayName.value = u.displayName ?? ''
  age.value = u.age ?? undefined
  gender.value = u.gender ?? ''
  country.value = u.country ?? ''
  avatarPreview.value = u.avatar ?? null
}, { immediate: true })

async function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  avatarError.value = null
  uploading.value = true
  try {
    const webp = await convertToWebP(file)
    avatarDataUrl.value = webp
    avatarPreview.value = webp
  } catch (err: any) {
    avatarError.value = err?.message ?? 'Failed to process image.'
  } finally {
    uploading.value = false
  }
}

function removeAvatar() {
  avatarPreview.value = null
  avatarDataUrl.value = null
}

async function onSave() {
  saving.value = true
  message.value = null
  const payload: any = {}
  payload.displayName = displayName.value.trim() === '' ? null : displayName.value.trim()
  payload.age = age.value === undefined || age.value === null ? null : Number(age.value)
  payload.gender = gender.value === '' ? null : gender.value
  payload.country = country.value.trim() === '' ? null : country.value.trim()
  if (avatarDataUrl.value) payload.avatar = avatarDataUrl.value
  if (avatarPreview.value === null && auth.user.value?.avatar) payload.avatar = null

  const ok = await auth.updateProfile(payload)
  if (ok) {
    message.value = 'Profile updated successfully!'
    avatarDataUrl.value = null
  }
  saving.value = false
}

async function onRefreshToken() {
  const ok = await auth.refresh()
  message.value = ok ? 'Token refreshed successfully!' : 'Refresh failed.'
}

const countries = ['Indonesia','Malaysia','Singapore','Japan','United States','United Kingdom','Germany','France','Australia','Brazil','India','South Korea','Thailand','Vietnam','Philippines','Other']

const genderIcon = computed(() => {
  if (gender.value === 'male') return 'i-lucide-mars'
  if (gender.value === 'female') return 'i-lucide-venus'
  return 'i-lucide-user'
})

const memberSince = computed(() => {
  if (!auth.user.value?.createdAt) return '-'
  const d = new Date(auth.user.value.createdAt)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <!-- Not logged in -->
    <div v-if="!auth.isAuthenticated.value" class="mt-12">
      <UAlert color="warning" variant="subtle" icon="i-lucide-lock" title="Login required" description="Please login to view and edit your profile.">
        <template #actions>
          <UButton to="/login" color="primary" size="sm">Login</UButton>
          <UButton to="/register" color="neutral" variant="outline" size="sm">Register</UButton>
        </template>
      </UAlert>
    </div>

    <template v-else>
      <!-- Header banner -->
      <div class="relative overflow-hidden rounded-2xl border border-ink-800 bg-gradient-to-br from-ink-900 via-ink-900 to-primary-950/30">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,197,94,0.08),transparent_60%)]" />
        <div class="relative px-6 pt-8 pb-6 sm:px-8">
          <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
            <!-- Avatar -->
            <div class="relative group">
              <div class="size-24 overflow-hidden rounded-2xl border-2 border-ink-700 bg-ink-800 shadow-lg shadow-black/30 sm:size-28">
                <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" class="h-full w-full object-cover" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <UIcon :name="genderIcon" class="size-10 text-neutral-600" />
                </div>
              </div>
              <label class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <UIcon name="i-lucide-camera" class="size-6 text-white" />
                <input type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
              </label>
              <div v-if="uploading" class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60">
                <UIcon name="i-lucide-loader-2" class="size-5 animate-spin text-primary-400" />
              </div>
            </div>

            <!-- User info -->
            <div class="flex-1 text-center sm:text-left">
              <h1 class="text-xl font-bold tracking-tight text-neutral-50 sm:text-2xl">
                {{ auth.user.value?.displayName || auth.user.value?.username }}
              </h1>
              <p class="mt-0.5 text-sm text-neutral-400">@{{ auth.user.value?.username }}</p>
              <div class="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-500 sm:justify-start">
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-lucide-mail" class="size-3.5" />
                  {{ auth.user.value?.email }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-lucide-calendar" class="size-3.5" />
                  Joined {{ memberSince }}
                </span>
                <UBadge v-if="auth.user.value?.role === 'admin'" color="primary" size="xs" variant="solid">Admin</UBadge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div class="mt-4 space-y-3">
        <UAlert v-if="message" color="success" variant="soft" icon="i-lucide-check-circle" :title="message" @close="message = null" />
        <UAlert v-if="auth.error.value" color="error" variant="soft" icon="i-lucide-alert-circle" :title="auth.error.value" @close="auth.error.value = null" />
        <UAlert v-if="avatarError" color="error" variant="soft" icon="i-lucide-alert-circle" :title="avatarError" @close="avatarError = null" />
      </div>

      <!-- Profile form -->
      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <!-- Personal info card -->
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5 sm:col-span-2">
          <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <UIcon name="i-lucide-user" class="size-4 text-primary-400" />
            Personal Information
          </h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-neutral-400">Display Name</label>
              <UInput v-model="displayName" placeholder="Your display name" maxlength="50" icon="i-lucide-badge-check" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-neutral-400">Age</label>
              <UInput v-model.number="age" type="number" placeholder="25" :min="1" :max="120" icon="i-lucide-hash" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-neutral-400">Gender</label>
              <div class="flex gap-2">
                <button
                  v-for="g in [{v:'',l:'None',i:'i-lucide-minus'},{v:'male',l:'Male',i:'i-lucide-mars'},{v:'female',l:'Female',i:'i-lucide-venus'}]"
                  :key="g.v"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all"
                  :class="gender === g.v ? 'border-primary-500 bg-primary-500/10 text-primary-400' : 'border-ink-700 bg-ink-850 text-neutral-400 hover:border-ink-600 hover:text-neutral-300'"
                  @click="gender = g.v"
                >
                  <UIcon :name="g.i" class="size-4" />
                  {{ g.l }}
                </button>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-neutral-400">Country</label>
              <UInput v-model="country" placeholder="e.g. Indonesia" maxlength="56" icon="i-lucide-globe" />
            </div>
          </div>
        </div>

        <!-- Avatar card -->
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <UIcon name="i-lucide-image" class="size-4 text-primary-400" />
            Avatar
          </h2>
          <div class="flex items-center gap-4">
            <div class="size-16 overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
              <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" class="h-full w-full object-cover" />
              <div v-else class="flex h-full w-full items-center justify-center">
                <UIcon name="i-lucide-user" class="size-6 text-neutral-600" />
              </div>
            </div>
            <div class="flex-1 space-y-1.5">
              <label class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-ink-800 hover:text-neutral-200">
                <UIcon name="i-lucide-upload" class="size-3.5" />
                Upload new
                <input type="file" accept="image/*" class="hidden" @change="onAvatarChange" />
              </label>
              <button v-if="avatarPreview" class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-red-800 hover:bg-red-950/30 hover:text-red-400" @click="removeAvatar">
                <UIcon name="i-lucide-trash-2" class="size-3.5" />
                Remove
              </button>
            </div>
          </div>
          <p class="mt-3 text-[11px] text-neutral-600">Max 5MB, auto-converted to WebP</p>
        </div>

        <!-- Account card -->
        <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
          <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-200">
            <UIcon name="i-lucide-shield" class="size-4 text-primary-400" />
            Account
          </h2>
          <div class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-neutral-500">Username</span>
              <span class="font-medium text-neutral-200">{{ auth.user.value?.username }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-neutral-500">Email</span>
              <span class="font-medium text-neutral-200">{{ auth.user.value?.email }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-neutral-500">Role</span>
              <UBadge :color="auth.user.value?.role === 'admin' ? 'primary' : 'neutral'" size="xs">{{ auth.user.value?.role ?? 'user' }}</UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-neutral-500">JWT Token</span>
              <span class="text-xs text-neutral-400">~7 days</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 flex flex-wrap gap-3">
        <UButton color="primary" size="md" icon="i-lucide-save" :loading="saving || auth.pending.value" @click="onSave">
          Save Profile
        </UButton>
        <UButton color="neutral" variant="outline" size="md" icon="i-lucide-refresh-cw" @click="onRefreshToken">
          Refresh Token
        </UButton>
        <UButton color="neutral" variant="ghost" size="md" icon="i-lucide-layout-grid" to="/decks">
          My Decks
        </UButton>
      </div>
    </template>
  </div>
</template>
