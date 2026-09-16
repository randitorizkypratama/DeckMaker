import type { PublicUser, Role, User } from '../../domain/user/User.ts'

/**
 * Custom banlist entry — admin overrides per card.
 */
export interface CustomBanlistEntry {
  cardId: number
  status: 'Forbidden' | 'Limited' | 'Semi-Limited'
  reason: string | null
  createdBy: string | null
  createdAt: string
}

export interface AdminStats {
  totalUsers: number
  totalDecks: number
  totalFavorites: number
}
