import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxt/ui'],
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  // Dark, game-inspired UI is the intended default.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  runtimeConfig: {
    public: {
      // Only the API base URL is exposed to the browser; no secrets here.
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    },
  },

  app: {
    head: {
      title: 'DuelDex - Explore cards. Build smarter decks.',
      htmlAttrs: { lang: 'en', class: 'dark' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Discover Yu-Gi-Oh! cards, analyze archetypes, and build decks around the cards you love.',
        },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  typescript: {
    strict: true,
  },

  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },

  future: {
    compatibilityVersion: 4,
  },
})
