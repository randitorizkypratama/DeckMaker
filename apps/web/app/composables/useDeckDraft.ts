/**
 * Carries card selections from the explorer or card detail page into the
 * deck builder, so "Add to Deck" works across a route change.
 */
export function useDeckDraft() {
  const pendingCardIds = useState<number[]>('dueldex-deck-draft', () => [])

  function addPendingCard(cardId: number): void {
    if (!pendingCardIds.value.includes(cardId)) {
      pendingCardIds.value = [...pendingCardIds.value, cardId]
    }
  }

  /** Returns the queued ids and clears the queue. */
  function consumePendingCards(): number[] {
    const ids = [...pendingCardIds.value]
    pendingCardIds.value = []
    return ids
  }

  return { pendingCardIds, addPendingCard, consumePendingCards }
}
