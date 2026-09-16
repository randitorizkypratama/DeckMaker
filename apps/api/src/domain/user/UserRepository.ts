import type { User } from './User.ts'

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  count(): Promise<number>
  list(opts?: { q?: string; page?: number; pageSize?: number }): Promise<User[]>
  delete(id: string): Promise<void>
  create(user: User): Promise<User>
  update(user: User): Promise<User>
}
