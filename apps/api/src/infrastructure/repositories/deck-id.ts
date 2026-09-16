import { randomBytes } from 'node:crypto'

/**
 * Short, URL-safe, non-sequential public deck identifiers.
 *
 * Ambiguous characters (0/O, 1/I/l) are excluded so IDs survive being read
 * aloud or copied by hand. Randomly generated rather than derived from a
 * database key, so internal ids are never exposed.
 */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz'
const ID_LENGTH = 10

export function generateDeckId(): string {
  const bytes = randomBytes(ID_LENGTH)
  let id = ''
  for (let index = 0; index < ID_LENGTH; index += 1) {
    id += ALPHABET[bytes[index]! % ALPHABET.length]
  }
  return id
}

const ID_PATTERN = new RegExp(`^[${ALPHABET}]{${ID_LENGTH}}$`)

export function isValidDeckId(value: string): boolean {
  return ID_PATTERN.test(value)
}
