# DuelDex

Yu-Gi-Oh! deck builder. Search cards, build decks with AI synergy scoring, validate against real TCG banlist.

## What it does

- **Card Explorer**: Search 10,000+ cards by name, type, attribute, archetype, race, ATK/DEF. Filter, sort, paginate.
- **Smart Deck Builder**: Pick a key card → system finds archetype support → scores synergy → outputs format-valid deck. No random guessing.
- **Banlist Enforcement**: Real TCG banlist. Forbidden/Limited/Semi-Limited checked on generation and save. Divine-Beast/Creator God limited to 1 copy.
- **Deck Analytics**: Level curve, ATK histogram, archetype breakdown, opening hand simulator.
- **Meta Analytics**: Card popularity, archetype usage, format distribution across all public decks.
- **Admin Panel**: User management (ban/promote/delete), deck management, official banlist viewer with card preview.
- **User System**: Register, login, avatar upload, favorites, deck CRUD (max 5 per user), share decks by URL.

## What it doesn't do

- No real-time dueling
- No card trading
- No deck import from ydk/ydke
- No AI chatbot
- No mobile app (responsive web only)
- No tournament system
- No deck versioning/history

## Stack

- **API**: Bun + ElysiaJS, SQLite (WAL mode), clean architecture
- **Frontend**: Nuxt 4 + Vue 3.5 + Tailwind 4 + Nuxt UI v3
- **Shared**: Monorepo types via `packages/shared`
- **External**: YGOPRODeck API for card data + images

## Architecture

```
presentation (routes) → application (services) → domain (rules) ← infrastructure (db, API)
```

Domain layer has zero framework imports. All HTTP/persistence lives in infrastructure.
