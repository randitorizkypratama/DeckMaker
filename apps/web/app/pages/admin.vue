<script setup lang="ts">
import type { Card, Paginated } from '@dueldex/shared'

useHead({ title: 'Admin Panel - DuelDex' })

const auth = useAuth()
const api = useApi()

onMounted(() => auth.loadFromStorage())

const isAdmin = computed(() => auth.user.value?.role === 'admin')

const tab = ref<'users' | 'decks' | 'banlist' | 'stats'>('users')

// Users
const users = ref<any[]>([])
const usersPending = ref(false)
const usersQ = ref('')
const usersRole = ref<'all' | 'admin' | 'user'>('all')
const usersStatus = ref<'all' | 'active' | 'banned'>('all')
const usersPage = ref(1)
const usersTotalPages = ref(0)
const editUser = ref<any | null>(null)
const editUserOpen = ref(false)
const editUserPending = ref(false)
const deleteConfirm = ref<{ type: 'user' | 'deck'; id: string; name: string } | null>(null)
const deleteConfirmOpen = ref(false)
const deletePending = ref(false)

async function loadUsers() {
  if (!isAdmin.value) return
  usersPending.value = true
  try {
    const res = await api.request<Paginated<any>>('/api/admin/users', {
      query: { q: usersQ.value || undefined, page: usersPage.value, pageSize: 15 } as any,
    })
    users.value = res.items
    usersTotalPages.value = res.pagination.totalPages
  } catch {} finally { usersPending.value = false }
}

const filteredUsers = computed(() => {
  let list = users.value
  if (usersRole.value !== 'all') list = list.filter((u) => u.role === usersRole.value)
  if (usersStatus.value !== 'all') list = list.filter((u) => usersStatus.value === 'banned' ? u.isBanned : !u.isBanned)
  return list
})

function closeEditUser() { editUserOpen.value = false }
function closeDeleteConfirm() { deleteConfirmOpen.value = false }

function openEditUser(user: any) {
  editUser.value = { ...user }
  editUserOpen.value = true
}

async function saveEditUser() {
  if (!editUser.value) return
  editUserPending.value = true
  try {
    await api.request(`/api/admin/users/${editUser.value.id}`, {
      method: 'PUT',
      body: { role: editUser.value.role, isBanned: editUser.value.isBanned } as any,
    })
    editUser.value = null
    editUserOpen.value = false
    await loadUsers()
  } catch {} finally { editUserPending.value = false }
}

function confirmDelete(type: 'user' | 'deck', id: string, name: string) {
  deleteConfirm.value = { type, id, name }
  deleteConfirmOpen.value = true
}

async function executeDelete() {
  if (!deleteConfirm.value) return
  deletePending.value = true
  try {
    if (deleteConfirm.value.type === 'user') {
      await api.request(`/api/admin/users/${deleteConfirm.value.id}`, { method: 'DELETE' })
      await loadUsers()
    } else {
      await api.request(`/api/admin/decks/${deleteConfirm.value.id}`, { method: 'DELETE' })
      await loadDecks()
    }
    deleteConfirm.value = null
    deleteConfirmOpen.value = false
  } catch {} finally { deletePending.value = false }
}

// Decks
const decks = ref<any[]>([])
const decksPending = ref(false)
const decksQ = ref('')
const decksFormat = ref<'all' | 'yu-gi-oh' | 'speed-duel'>('all')
const decksPage = ref(1)
const decksTotalPages = ref(0)

async function loadDecks() {
  if (!isAdmin.value) return
  decksPending.value = true
  try {
    const res = await api.request<Paginated<any>>('/api/admin/decks', {
      query: { q: decksQ.value || undefined, page: decksPage.value, pageSize: 15 } as any,
    })
    decks.value = res.items
    decksTotalPages.value = res.pagination?.totalPages ?? 1
  } catch {} finally { decksPending.value = false }
}

const filteredDecks = computed(() => {
  if (decksFormat.value === 'all') return decks.value
  return decks.value.filter((d) => d.format === decksFormat.value)
})

// Banlist
const officialBanlist = ref<Card[]>([])
const banlistPending = ref(false)
const banlistFilter = ref<'all' | 'Forbidden' | 'Limited' | 'Semi-Limited'>('all')
const banlistSearch = ref('')
const banlistType = ref('')
const banlistAttribute = ref('')
const banlistRace = ref('')
const banlistSort = ref<'name' | 'status'>('name')

const banlistTypes = computed(() => {
  const types = new Set<string>()
  for (const c of officialBanlist.value) types.add(c.type)
  return [...types].sort()
})

const banlistAttributes = computed(() => {
  const attrs = new Set<string>()
  for (const c of officialBanlist.value) { if (c.attribute) attrs.add(c.attribute) }
  return [...attrs].sort()
})

const banlistRaces = computed(() => {
  const races = new Set<string>()
  for (const c of officialBanlist.value) { if (c.race) races.add(c.race) }
  return [...races].sort()
})

async function loadBanlist() {
  if (!isAdmin.value) return
  banlistPending.value = true
  try {
    officialBanlist.value = await api.request<Card[]>('/api/admin/banlist/official')
  } catch {} finally { banlistPending.value = false }
}

const filteredBanlist = computed(() => {
  let list = officialBanlist.value
  if (banlistFilter.value !== 'all') {
    list = list.filter((c) => c.banlist?.tcg === banlistFilter.value)
  }
  if (banlistType.value) list = list.filter((c) => c.type === banlistType.value)
  if (banlistAttribute.value) list = list.filter((c) => c.attribute === banlistAttribute.value)
  if (banlistRace.value) list = list.filter((c) => c.race === banlistRace.value)
  if (banlistSearch.value) {
    const q = banlistSearch.value.toLowerCase()
    list = list.filter((c) => c.name.toLowerCase().includes(q))
  }
  if (banlistSort.value === 'status') {
    const order: Record<string, number> = { Forbidden: 0, Limited: 1, 'Semi-Limited': 2 }
    list = [...list].sort((a, b) => (order[a.banlist?.tcg ?? ''] ?? 3) - (order[b.banlist?.tcg ?? ''] ?? 3))
  } else {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name))
  }
  return list
})

const banlistCounts = computed(() => {
  const counts = { Forbidden: 0, Limited: 0, 'Semi-Limited': 0 }
  for (const c of officialBanlist.value) {
    const s = c.banlist?.tcg
    if (s && s in counts) counts[s as keyof typeof counts]++
  }
  return counts
})

const previewCard = ref<Card | null>(null)
const previewCardOpen = ref(false)

function openPreview(card: Card) {
  previewCard.value = card
  previewCardOpen.value = true
}

// Stats
const stats = ref<any>(null)
const statsPending = ref(false)

async function loadStats() {
  if (!isAdmin.value) return
  statsPending.value = true
  try { stats.value = await api.request<any>('/api/admin/stats') } catch {} finally { statsPending.value = false }
}

const tabs = [
  { key: 'users', label: 'Users', icon: 'i-lucide-users' },
  { key: 'decks', label: 'Decks', icon: 'i-lucide-layout-grid' },
  { key: 'banlist', label: 'Banlist', icon: 'i-lucide-shield-alert' },
  { key: 'stats', label: 'Stats', icon: 'i-lucide-bar-chart-3' },
] as const

watch(tab, (t) => {
  if (t === 'users') loadUsers()
  else if (t === 'decks') loadDecks()
  else if (t === 'banlist') loadBanlist()
  else if (t === 'stats') loadStats()
})

onMounted(() => { if (isAdmin.value) loadUsers() })
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-neutral-50">Admin Panel</h1>
      <p class="mt-1 text-sm text-neutral-400">Manage users, decks, and the official banlist.</p>
    </div>

    <UAlert v-if="!auth.isAuthenticated.value" color="warning" variant="subtle" icon="i-lucide-lock" title="Login required" description="Please login to access the admin panel.">
      <template #actions><UButton to="/login" color="primary" size="sm">Login</UButton></template>
    </UAlert>
    <UAlert v-else-if="!isAdmin" color="error" variant="subtle" icon="i-lucide-shield-x" title="Access denied" description="You need admin privileges to access this page." />

    <template v-else>
      <div class="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-ink-900 p-1">
        <button
          v-for="t in tabs" :key="t.key"
          class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:text-sm"
          :class="tab === t.key ? 'bg-primary-500/15 text-primary-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-ink-800'"
          @click="tab = t.key as any"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
        </button>
      </div>

      <!-- USERS -->
      <div v-if="tab === 'users'">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <UInput v-model="usersQ" placeholder="Search username or email..." icon="i-lucide-search" class="w-full sm:w-64" @keydown.enter="loadUsers" />
          <select v-model="usersRole" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select v-model="usersStatus" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          <UButton color="primary" size="sm" @click="loadUsers">Search</UButton>
        </div>

        <CommonLoadingState v-if="usersPending" label="Loading users..." />
        <div v-else-if="filteredUsers.length === 0" class="rounded-xl border border-dashed border-ink-700 py-12 text-center text-sm text-neutral-500">No users found.</div>
        <div v-else class="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
          <table class="w-full min-w-[540px] text-left text-sm">
            <thead class="border-b border-ink-800 bg-ink-850 text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th class="px-4 py-3">User</th>
                <th class="px-4 py-3">Role</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Joined</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in filteredUsers" :key="u.id" class="border-b border-ink-800/50 transition-colors hover:bg-ink-850/50">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img v-if="u.avatar" :src="u.avatar" class="size-8 rounded-full object-cover" />
                    <div v-else class="flex size-8 items-center justify-center rounded-full bg-primary-500/15 text-xs font-bold text-primary-400">
                      {{ (u.username ?? '?')[0].toUpperCase() }}
                    </div>
                    <div>
                      <div class="font-medium text-neutral-100">{{ u.username }}</div>
                      <div class="text-xs text-neutral-500">{{ u.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <UBadge :color="u.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" size="xs">{{ u.role }}</UBadge>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <span class="size-1.5 rounded-full" :class="u.isBanned ? 'bg-red-500' : 'bg-emerald-500'" />
                    <span class="text-xs" :class="u.isBanned ? 'text-red-400' : 'text-emerald-400'">{{ u.isBanned ? 'Banned' : 'Active' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-xs text-neutral-500">{{ new Date(u.createdAt).toLocaleDateString() }}</td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-1">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="openEditUser(u)" />
                    <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmDelete('user', u.id, u.username)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="usersTotalPages > 1" class="mt-4">
          <CommonPagination :page="usersPage" :total-pages="usersTotalPages" @change="(p: number) => { usersPage = p; loadUsers() }" />
        </div>
      </div>

      <!-- DECKS -->
      <div v-if="tab === 'decks'">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <UInput v-model="decksQ" placeholder="Search decks..." icon="i-lucide-search" class="w-full sm:w-64" @keydown.enter="loadDecks" />
          <select v-model="decksFormat" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
            <option value="all">All Formats</option>
            <option value="yu-gi-oh">Yu-Gi-Oh!</option>
            <option value="speed-duel">Speed Duel</option>
          </select>
          <UButton color="primary" size="sm" @click="loadDecks">Search</UButton>
        </div>

        <CommonLoadingState v-if="decksPending" label="Loading decks..." />
        <div v-else-if="filteredDecks.length === 0" class="rounded-xl border border-dashed border-ink-700 py-12 text-center text-sm text-neutral-500">No decks found.</div>
        <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="d in filteredDecks" :key="d.id" class="group rounded-xl border border-ink-800 bg-ink-900 p-4 transition-all hover:border-ink-700 hover:shadow-lg">
            <div class="font-medium text-neutral-100">{{ d.name }}</div>
            <div class="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <UBadge :color="d.format === 'yu-gi-oh' ? 'primary' : 'warning'" variant="subtle" size="xs">{{ d.format }}</UBadge>
              <span>{{ d.ownerName ?? 'anon' }}</span>
              <span>{{ new Date(d.createdAt).toLocaleDateString() }}</span>
            </div>
            <div class="mt-3 flex gap-2 border-t border-ink-800 pt-3">
              <UButton :to="`/deck/${d.id}`" size="xs" color="neutral" variant="outline" icon="i-lucide-eye">View</UButton>
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmDelete('deck', d.id, d.name)">Delete</UButton>
            </div>
          </div>
        </div>
        <div v-if="decksTotalPages > 1" class="mt-4">
          <CommonPagination :page="decksPage" :total-pages="decksTotalPages" @change="(p: number) => { decksPage = p; loadDecks() }" />
        </div>
      </div>

      <!-- BANLIST -->
      <div v-if="tab === 'banlist'">
        <div class="mb-4 space-y-3">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-lg font-medium text-neutral-100">Official TCG Banlist</h2>
            <UInput v-model="banlistSearch" placeholder="Search card name..." icon="i-lucide-search" class="w-full sm:w-64" />
            <select v-model="banlistSort" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
              <option value="name">Sort by Name</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="f in ([ 'all', 'Forbidden', 'Limited', 'Semi-Limited' ] as const)"
              :key="f"
              class="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              :class="banlistFilter === f
                ? f === 'Forbidden' ? 'bg-red-500/15 text-red-400' : f === 'Limited' ? 'bg-amber-500/15 text-amber-400' : f === 'Semi-Limited' ? 'bg-sky-500/15 text-sky-400' : 'bg-primary-500/15 text-primary-400'
                : 'bg-ink-800 text-neutral-400 hover:text-neutral-200'"
              @click="banlistFilter = f"
            >
              {{ f === 'all' ? 'All' : f }} ({{ f === 'all' ? officialBanlist.length : banlistCounts[f] }})
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <select v-model="banlistType" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
              <option value="">All Types</option>
              <option v-for="t in banlistTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="banlistAttribute" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
              <option value="">All Attributes</option>
              <option v-for="a in banlistAttributes" :key="a" :value="a">{{ a }}</option>
            </select>
            <select v-model="banlistRace" class="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 transition-colors focus:border-primary-500 focus:outline-none">
              <option value="">All Races</option>
              <option v-for="r in banlistRaces" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
        </div>
        <CommonLoadingState v-if="banlistPending" label="Loading banlist..." />
        <div v-else-if="filteredBanlist.length === 0" class="rounded-xl border border-dashed border-ink-700 py-12 text-center text-sm text-neutral-500">No cards found.</div>
        <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div v-for="c in filteredBanlist" :key="c.id" class="group flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3 transition-all hover:border-ink-700 hover:bg-ink-850/50 cursor-pointer" @click="openPreview(c)">
            <img v-if="c.cardImages?.[0]" :src="c.cardImages[0].imageUrlSmall" class="h-14 w-10 rounded-lg object-cover shadow-sm transition-transform group-hover:scale-105" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-neutral-100">{{ c.name }}</div>
              <div class="text-xs text-neutral-500">{{ c.type }}<template v-if="c.race"> &middot; {{ c.race }}</template></div>
            </div>
            <UBadge
              :color="c.banlist?.tcg === 'Forbidden' ? 'error' : c.banlist?.tcg === 'Limited' ? 'warning' : 'info'"
              variant="subtle" size="xs"
            >{{ c.banlist?.tcg }}</UBadge>
          </div>
        </div>
        <div class="mt-3 text-xs text-neutral-500">Showing {{ filteredBanlist.length }} of {{ officialBanlist.length }} cards</div>
      </div>

      <!-- STATS -->
      <div v-if="tab === 'stats'">
        <CommonLoadingState v-if="statsPending" label="Loading stats..." />
        <div v-else-if="stats" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-primary-500/15"><UIcon name="i-lucide-users" class="size-5 text-primary-400" /></div>
              <div>
                <div class="text-2xl font-bold text-neutral-50">{{ stats.totalUsers }}</div>
                <div class="text-xs text-neutral-400">Users</div>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15"><UIcon name="i-lucide-layout-grid" class="size-5 text-emerald-400" /></div>
              <div>
                <div class="text-2xl font-bold text-neutral-50">{{ stats.totalDecks }}</div>
                <div class="text-xs text-neutral-400">Decks</div>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-amber-500/15"><UIcon name="i-lucide-heart" class="size-5 text-amber-400" /></div>
              <div>
                <div class="text-2xl font-bold text-neutral-50">{{ stats.totalFavorites }}</div>
                <div class="text-xs text-neutral-400">Favorites</div>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-ink-800 bg-ink-900 p-6">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-red-500/15"><UIcon name="i-lucide-shield-alert" class="size-5 text-red-400" /></div>
              <div>
                <div class="text-2xl font-bold text-neutral-50">{{ banlistCounts.Forbidden + banlistCounts.Limited + banlistCounts['Semi-Limited'] }}</div>
                <div class="text-xs text-neutral-400">Banned Cards</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- EDIT USER MODAL -->
      <UModal v-model:open="editUserOpen" title="Edit User" :ui="{ content: 'bg-ink-900 border border-ink-800' }">
        <template #body>
          <div v-if="editUser" class="space-y-4">
            <div>
              <label class="mb-1 block text-xs text-neutral-400">Username</label>
              <div class="text-sm text-neutral-200">{{ editUser.username }}</div>
            </div>
            <div>
              <label class="mb-1 block text-xs text-neutral-400">Email</label>
              <div class="text-sm text-neutral-200">{{ editUser.email }}</div>
            </div>
            <div>
              <label class="mb-1 block text-xs text-neutral-400">Role</label>
              <select v-model="editUser.role" class="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-neutral-200 focus:border-primary-500 focus:outline-none">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-neutral-400">Status</label>
              <div class="flex gap-2">
                <button
                  class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all"
                  :class="!editUser.isBanned ? 'bg-emerald-500/15 text-emerald-400' : 'bg-ink-800 text-neutral-400 hover:text-neutral-200'"
                  @click="editUser.isBanned = false"
                >Active</button>
                <button
                  class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all"
                  :class="editUser.isBanned ? 'bg-red-500/15 text-red-400' : 'bg-ink-800 text-neutral-400 hover:text-neutral-200'"
                  @click="editUser.isBanned = true"
                >Banned</button>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="closeEditUser">Cancel</UButton>
            <UButton color="primary" :loading="editUserPending" @click="saveEditUser">Save Changes</UButton>
          </div>
        </template>
      </UModal>

      <!-- DELETE CONFIRM MODAL -->
      <UModal v-model:open="deleteConfirmOpen" title="Confirm Delete" :ui="{ content: 'bg-ink-900 border border-ink-800' }">
        <template #body>
          <div v-if="deleteConfirm" class="text-sm text-neutral-300">
            Are you sure you want to delete <span class="font-medium text-neutral-100">{{ deleteConfirm.name }}</span>?
            This action cannot be undone.
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="closeDeleteConfirm">Cancel</UButton>
            <UButton color="error" :loading="deletePending" @click="executeDelete">Delete</UButton>
          </div>
        </template>
      </UModal>

      <!-- CARD PREVIEW MODAL -->
      <UModal v-model:open="previewCardOpen" title="Card Preview" :ui="{ content: 'bg-ink-900 border border-ink-800 p-0 overflow-hidden' }">
        <template #body>
          <div v-if="previewCard" class="flex flex-col items-center gap-4 p-4">
            <img v-if="previewCard.cardImages?.[0]" :src="previewCard.cardImages[0].imageUrl" class="max-h-[60vh] rounded-xl shadow-2xl" />
            <div class="w-full text-center">
              <h3 class="text-lg font-bold text-neutral-50">{{ previewCard.name }}</h3>
              <div class="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-400">
                <span>{{ previewCard.type }}</span>
                <template v-if="previewCard.race"><span>&middot;</span><span>{{ previewCard.race }}</span></template>
                <template v-if="previewCard.attribute"><span>&middot;</span><span>{{ previewCard.attribute }}</span></template>
                <template v-if="previewCard.level"><span>&middot;</span><span>Lv. {{ previewCard.level }}</span></template>
              </div>
              <UBadge
                v-if="previewCard.banlist?.tcg"
                class="mt-2"
                :color="previewCard.banlist.tcg === 'Forbidden' ? 'error' : previewCard.banlist.tcg === 'Limited' ? 'warning' : 'info'"
                variant="subtle"
              >{{ previewCard.banlist.tcg }}</UBadge>
              <p class="mt-3 text-sm leading-relaxed text-neutral-300">{{ previewCard.desc }}</p>
              <div v-if="previewCard.atk !== undefined || previewCard.def !== undefined" class="mt-3 flex justify-center gap-4 text-sm">
                <span v-if="previewCard.atk !== undefined" class="text-amber-400">ATK {{ previewCard.atk }}</span>
                <span v-if="previewCard.def !== undefined" class="text-sky-400">DEF {{ previewCard.def }}</span>
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
