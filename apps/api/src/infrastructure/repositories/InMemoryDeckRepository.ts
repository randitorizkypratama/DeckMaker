import type { Deck } from '@dueldex/shared'
import type { DeckRepository } from '../../domain/deck/DeckRepository.ts'

export class InMemoryDeckRepository implements DeckRepository {
  private readonly decks = new Map<string, Deck>()

  async create(deck: Deck): Promise<Deck> {
    this.decks.set(deck.id, { ...deck })
    return deck
  }

  async findById(id: string): Promise<Deck | null> {
    const d = this.decks.get(id)
    return d ? { ...d } : null
  }

  async findByOwner(ownerId: string, opts?: { q?: string; sort?: string; order?: string; page?: number; pageSize?: number }): Promise<Deck[]> {
    let list = [...this.decks.values()].filter((d) => d.ownerId === ownerId)
    if (opts?.q) {
      const q = opts.q.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(q))
    }
    const sort = opts?.sort === 'name' ? 'name' : 'updatedAt'
    const order = opts?.order === 'asc' ? 1 : -1
    list.sort((a,b)=>{
      const av = sort==='name'? a.name : a.updatedAt
      const bv = sort==='name'? b.name : b.updatedAt
      return av < bv ? -1*order : av > bv ? 1*order : 0
    })
    if (opts?.page && opts?.pageSize) {
      const start = (opts.page-1)*opts.pageSize
      list = list.slice(start, start+opts.pageSize)
    }
    return list.map((d) => ({ ...d }))
  }

  async countByOwner(ownerId: string, q?: string): Promise<number> {
    let list = [...this.decks.values()].filter((d) => d.ownerId === ownerId)
    if (q) {
      const qq = q.toLowerCase()
      list = list.filter(d => d.name.toLowerCase().includes(qq))
    }
    return list.length
  }

  async update(deck: Deck): Promise<Deck> {
    this.decks.set(deck.id, { ...deck })
    return deck
  }

  async delete(id: string): Promise<void> {
    this.decks.delete(id)
  }
}
