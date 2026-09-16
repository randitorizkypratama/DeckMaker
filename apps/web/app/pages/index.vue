<script setup lang="ts">
import type { Card } from '@dueldex/shared'

const api = useApi()
const { isFavorite, toggleFavorite, hydrate } = useFavorites()

const featured = ref<Card[]>([])
const pending = ref(true)

const archetypes = [
  { name: 'Dark Magician', color: 'from-purple-500/20 to-purple-900/20', border: 'border-purple-500/30', icon: 'i-lucide-sparkles' },
  { name: 'Blue-Eyes', color: 'from-blue-500/20 to-blue-900/20', border: 'border-blue-500/30', icon: 'i-lucide-diamond' },
  { name: 'Elemental HERO', color: 'from-orange-500/20 to-orange-900/20', border: 'border-orange-500/30', icon: 'i-lucide-shield' },
  { name: 'Sky Striker', color: 'from-cyan-500/20 to-cyan-900/20', border: 'border-cyan-500/30', icon: 'i-lucide-wings' },
  { name: 'Salamangreat', color: 'from-red-500/20 to-red-900/20', border: 'border-red-500/30', icon: 'i-lucide-flame' },
  { name: 'Branded', color: 'from-amber-500/20 to-amber-900/20', border: 'border-amber-500/30', icon: 'i-lucide-crown' },
]

const features = [
  { icon: 'i-lucide-search', title: '10,000+ Cards', desc: 'Search the entire Yu-Gi-Oh! card database with advanced filters' },
  { icon: 'i-lucide-wand-2', title: 'Smart Generation', desc: 'AI-powered deck building based on synergy scoring' },
  { icon: 'i-lucide-shield-check', title: 'Banlist Valid', desc: 'Always legal with real TCG/OCG banlist enforcement' },
  { icon: 'i-lucide-bar-chart-3', title: 'Deck Analytics', desc: 'Stats, combos, opening hand simulator & more' },
]

const steps = [
  { icon: 'i-lucide-mouse-pointer-click', title: 'Pick a key card', body: 'Choose any card you want your strategy to revolve around.' },
  { icon: 'i-lucide-git-branch', title: 'We read its archetype', body: 'DuelDex detects the archetype and finds cards that reference it.' },
  { icon: 'i-lucide-sliders-horizontal', title: 'Synergy gets scored', body: 'Every candidate is ranked with an explanation of why it fits.' },
  { icon: 'i-lucide-layers', title: 'A legal deck comes out', body: 'Composition respects the copy limits and size rules of your format.' },
]

onMounted(async () => {
  await hydrate()
  try {
    const result = await api.request<{ items: Card[] }>('/api/cards', {
      query: { archetype: 'Dark Magician', pageSize: 6, page: 1 },
    })
    featured.value = result.items
  } catch {
    featured.value = []
  } finally {
    pending.value = false
  }
})
</script>

<template>
  <div class="overflow-hidden">
    <!-- Hero Section -->
    <section class="relative min-h-[85vh] flex items-center">
      <div class="absolute inset-0">
        <div class="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-primary-950/30" />
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.08),transparent_50%)]" />
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.06),transparent_50%)]" />
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%2322c55e&quot; fill-opacity=&quot;1&quot;%3E%3Cpath d=&quot;M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');" />
        <div class="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary-500/5 blur-[100px] animate-pulse" />
        <div class="absolute bottom-1/4 right-1/4 size-80 rounded-full bg-blue-500/5 blur-[80px] animate-pulse" style="animation-delay: 1s;" />
      </div>

      <div class="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div class="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1.5">
              <span class="size-1.5 rounded-full bg-primary-400 animate-pulse" />
              <span class="text-xs font-medium text-primary-300">Card Explorer & Smart Deck Builder</span>
            </div>

            <h1 class="text-5xl font-black tracking-tight text-neutral-50 sm:text-6xl lg:text-7xl">
              DUEL
              <span class="bg-gradient-to-r from-primary-400 to-emerald-300 bg-clip-text text-transparent">DEX</span>
            </h1>

            <p class="mt-6 max-w-lg text-lg text-neutral-300 sm:text-xl">
              Explore cards. Build smarter decks. Dominate the duel.
            </p>

            <p class="mt-3 max-w-lg text-sm leading-relaxed text-neutral-400">
              10,000+ cards, AI-powered synergy scoring, real banlist validation, and deck analytics — everything you need to build the perfect deck.
            </p>

            <div class="mt-8 flex flex-wrap gap-4">
              <UButton to="/cards" size="lg" color="primary" icon="i-lucide-search" class="shadow-lg shadow-primary-500/20">
                Explore Cards
              </UButton>
              <UButton to="/deck/new" size="lg" color="neutral" variant="outline" icon="i-lucide-wand-2">
                Build a Deck
              </UButton>
            </div>

            <div class="mt-12 grid grid-cols-3 gap-6 border-t border-ink-800 pt-8">
              <div>
                <div class="text-2xl font-bold text-neutral-100">10K+</div>
                <div class="text-xs text-neutral-500">Cards</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-neutral-100">100+</div>
                <div class="text-xs text-neutral-500">Archetypes</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-neutral-100">2</div>
                <div class="text-xs text-neutral-500">Formats</div>
              </div>
            </div>
          </div>

          <!-- Right: Card showcase -->
          <div class="relative hidden lg:block">
            <div class="relative mx-auto w-80">
              <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/20 to-blue-500/20 blur-3xl" />
              <div class="relative space-y-4">
                <div v-for="(card, i) in featured.slice(0, 3)" :key="card.id"
                  class="relative rounded-2xl border border-ink-700 bg-ink-900 p-3 shadow-2xl transition-transform duration-500 hover:scale-105"
                  :style="{ transform: `rotate(${(i - 1) * 3}deg) translateY(${i * -20}px)`, zIndex: 3 - i }"
                >
                  <div class="flex items-center gap-3">
                    <div class="size-16 overflow-hidden rounded-xl bg-ink-800">
                      <img v-if="card.cardImages[0]" :src="card.cardImages[0].imageUrlSmall" :alt="card.name" class="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold text-neutral-100">{{ card.name }}</p>
                      <p class="truncate text-xs text-neutral-500">{{ card.type }}</p>
                    </div>
                  </div>
                </div>
                <div class="rounded-2xl border-2 border-dashed border-ink-700 bg-ink-900/50 p-6 text-center">
                  <UIcon name="i-lucide-plus" class="mx-auto size-8 text-neutral-600" />
                  <p class="mt-2 text-xs text-neutral-500">Your next deck</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features strip -->
    <section class="border-y border-ink-800 bg-ink-900/50">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="f in features" :key="f.title" class="flex items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
              <UIcon :name="f.icon" class="size-5 text-primary-400" />
            </div>
            <div>
              <p class="text-sm font-semibold text-neutral-100">{{ f.title }}</p>
              <p class="text-xs text-neutral-500">{{ f.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured cards -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div class="mb-8 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold text-neutral-50">Featured Cards</h2>
          <p class="mt-1 text-sm text-neutral-400">Dark Magician archetype — the iconic starter</p>
        </div>
        <NuxtLink to="/cards" class="group flex items-center gap-1 text-sm text-neutral-400 hover:text-primary-400 transition-colors">
          Browse all
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5" />
        </NuxtLink>
      </div>
      <CardsCardGrid
        :cards="featured"
        :pending="pending"
        :skeleton-count="6"
        :is-favorite="isFavorite"
        @toggle-favorite="toggleFavorite"
        @add="navigateTo(`/cards/${$event.id}`)"
      />
    </section>

    <!-- How it works -->
    <section class="border-y border-ink-800 bg-gradient-to-b from-ink-900/50 to-ink-950">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-neutral-50">How It Works</h2>
          <p class="mt-2 max-w-2xl mx-auto text-sm text-neutral-400">
            Rule-based synergy scoring, not random card picking. Every recommendation comes with the reasons behind it.
          </p>
        </div>
        <ol class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            class="group relative rounded-xl border border-ink-800 bg-ink-900/80 p-5 transition-all duration-300 hover:border-ink-600 hover:bg-ink-900"
          >
            <div class="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary-500/10 text-primary-400 transition-colors group-hover:bg-primary-500/20">
              <span class="text-lg font-bold">{{ index + 1 }}</span>
            </div>
            <h3 class="text-sm font-semibold text-neutral-100">{{ step.title }}</h3>
            <p class="mt-2 text-xs leading-relaxed text-neutral-400">{{ step.body }}</p>
            <div v-if="index < steps.length - 1" class="absolute right-0 top-1/2 hidden w-6 border-t border-ink-700 lg:block" />
          </li>
        </ol>
      </div>
    </section>

    <!-- Archetypes & Formats -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div class="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 class="text-2xl font-bold text-neutral-50">Popular Archetypes</h2>
          <p class="mt-2 text-sm text-neutral-400">Jump straight into your favorite strategy</p>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <NuxtLink
              v-for="arch in archetypes"
              :key="arch.name"
              :to="`/cards?archetype=${encodeURIComponent(arch.name)}`"
              :class="['group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg', arch.border, `bg-gradient-to-br ${arch.color}`]"
            >
              <UIcon :name="arch.icon" class="mb-2 size-5 text-neutral-400 group-hover:text-neutral-200 transition-colors" />
              <p class="text-sm font-semibold text-neutral-100">{{ arch.name }}</p>
              <UIcon name="i-lucide-arrow-right" class="mt-2 size-4 text-neutral-500 transition-transform group-hover:translate-x-1" />
            </NuxtLink>
          </div>
        </div>

        <div>
          <h2 class="text-2xl font-bold text-neutral-50">Supported Formats</h2>
          <p class="mt-2 text-sm text-neutral-400">Build decks for any competitive format</p>
          <div class="mt-6 space-y-4">
            <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <UIcon name="i-lucide-crown" class="size-5 text-amber-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-neutral-100">Yu-Gi-Oh! (TCG)</h3>
                  <p class="text-xs text-neutral-400">40-60 Main, 15 Extra, 15 Side, 3 copies</p>
                </div>
              </div>
            </div>
            <div class="rounded-xl border border-ink-800 bg-ink-900 p-5">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-lg bg-cyan-500/10">
                  <UIcon name="i-lucide-zap" class="size-5 text-cyan-400" />
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-neutral-100">Rush Duel</h3>
                  <p class="text-xs text-neutral-400">40-60 Main, no Extra or Side Deck</p>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-xl border border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-primary-900/10 p-6">
            <h3 class="text-lg font-bold text-neutral-50">Ready to build?</h3>
            <p class="mt-2 text-sm text-neutral-400">Create your first deck in seconds with smart generation.</p>
            <UButton to="/deck/new" size="lg" color="primary" icon="i-lucide-wand-2" class="mt-4 shadow-lg shadow-primary-500/20">
              Start Building
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-ink-800 bg-ink-950">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div class="flex items-center gap-2">
            <span class="flex size-7 items-center justify-center rounded bg-primary-500 text-sm font-bold text-ink-950">D</span>
            <span class="text-sm font-semibold text-neutral-300">DuelDex</span>
          </div>
          <p class="text-xs text-neutral-500">
            Card data from <a href="https://ygoprodeck.com" target="_blank" class="text-neutral-400 hover:text-primary-400">YGOPRODeck</a>. Not affiliated with Konami.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>
