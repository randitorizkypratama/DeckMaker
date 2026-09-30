import { config } from './config.ts'
import { getDatabase } from './infrastructure/db/database.ts'
import { CardService } from './application/cards/CardService.ts'
import { DeckGeneratorService } from './application/decks/DeckGeneratorService.ts'
import { DeckService } from './application/decks/DeckService.ts'
import { FavoritesService } from './application/favorites/FavoritesService.ts'
import { AuthService } from './application/auth/AuthService.ts'
import { AdminService } from './application/admin/AdminService.ts'
import { MetaService } from './application/meta/MetaService.ts'
import { SqliteDeckRepository } from './infrastructure/repositories/SqliteDeckRepository.ts'
import { SqliteFavoritesRepository } from './infrastructure/repositories/SqliteFavoritesRepository.ts'
import { SqliteUserRepository } from './infrastructure/repositories/SqliteUserRepository.ts'
import { YgoProDeckClient } from './infrastructure/ygoprodeck/YgoProDeckClient.ts'
import { YgoProDeckRepository } from './infrastructure/ygoprodeck/YgoProDeckRepository.ts'

/**
 * Composition root. The only place where concrete implementations are chosen
 * and wired to the interfaces the application layer depends on.
 * Single SQLite Database instance shared across all repositories.
 */
export interface Container {
  cardService: CardService
  deckService: DeckService
  deckGeneratorService: DeckGeneratorService
  favoritesService: FavoritesService
  authService: AuthService
  adminService: AdminService
  metaService: MetaService
}

export async function createContainer(): Promise<Container> {
  const db = await getDatabase(config.databasePath, config.tursoDatabaseUrl || undefined, config.tursoAuthToken || undefined)
  const client = new YgoProDeckClient()
  const cardRepository = new YgoProDeckRepository(client)
  const deckRepository = new SqliteDeckRepository(db)
  const favoritesRepository = new SqliteFavoritesRepository(db)
  const userRepository = new SqliteUserRepository(db)

  const cardService = new CardService(cardRepository)
  const deckService = new DeckService(deckRepository, cardRepository)
  const deckGeneratorService = new DeckGeneratorService(cardRepository, deckService)
  const favoritesService = new FavoritesService(favoritesRepository, cardRepository)
  const authService = new AuthService(userRepository, config.jwtSecret)
  const adminService = new AdminService(db)
  const metaService = new MetaService(db, cardRepository)

  return { cardService, deckService, deckGeneratorService, favoritesService, authService, adminService, metaService }
}
