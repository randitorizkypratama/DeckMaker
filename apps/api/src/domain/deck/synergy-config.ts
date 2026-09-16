/**
 * Synergy scoring configuration.
 *
 * All weights live here as named values so the recommendation engine
 * contains no magic numbers and tuning requires no engine changes.
 */
export interface SynergyWeights {
  archetypeMatch: number
  explicitKeyCardReference: number
  supportRelationship: number
  sameStrategy: number
  sameAttribute: number
  sameRaceOrType: number
  genericUseful: number
  /** Applied to cards whose text references the key card's archetype. */
  archetypeReference: number
  /** Small bonus for low-level monsters that are easy to summon. */
  searchableBonus: number
  /** Bonus for cards that form a known combo pair. */
  comboPair: number
  /** Bonus for cards whose effect keywords synergize. */
  effectSynergy: number
  /** Bonus for cards that protect/negate (control strategy). */
  controlBonus: number
  /** Bonus for cards that enable OTK/aggressive plays. */
  aggroBonus: number
}

export const DEFAULT_SYNERGY_WEIGHTS: SynergyWeights = {
  archetypeMatch: 50,
  explicitKeyCardReference: 30,
  supportRelationship: 25,
  sameStrategy: 20,
  sameAttribute: 10,
  sameRaceOrType: 5,
  genericUseful: 3,
  archetypeReference: 22,
  searchableBonus: 4,
  comboPair: 35,
  effectSynergy: 8,
  controlBonus: 6,
  aggroBonus: 6,
}

/**
 * Deck composition targets per format, expressed as ratios of the main deck.
 * The generator uses these to shape a playable spread of card kinds rather
 * than filling a deck with monsters only.
 */
export interface CompositionTargets {
  monsterRatio: number
  spellRatio: number
  trapRatio: number
}

export const COMPOSITION_TARGETS: Record<string, CompositionTargets> = {
  'yu-gi-oh': { monsterRatio: 0.55, spellRatio: 0.3, trapRatio: 0.15 },
  // Rush Duel games are faster and lean more heavily on monsters and spells.
  rush: { monsterRatio: 0.6, spellRatio: 0.32, trapRatio: 0.08 },
}

/**
 * Archetype-based composition overrides.
 * When the key card matches an archetype, these ratios replace the defaults.
 */
export interface ArchetypeProfile {
  monsterRatio: number
  spellRatio: number
  trapRatio: number
  description: string
}

export const ARCHETYPE_PROFILES: Record<string, ArchetypeProfile> = {
  'aggro': { monsterRatio: 0.65, spellRatio: 0.28, trapRatio: 0.07, description: 'Aggressive monster-heavy build' },
  'control': { monsterRatio: 0.4, spellRatio: 0.3, trapRatio: 0.3, description: 'Trap-heavy control build' },
  'combo': { monsterRatio: 0.58, spellRatio: 0.35, trapRatio: 0.07, description: 'Spell-heavy combo build' },
  'stun': { monsterRatio: 0.45, spellRatio: 0.2, trapRatio: 0.35, description: 'Trap stun build' },
}

/**
 * Known combo pairs: [cardNameA, cardNameB] where both cards are significantly
 * better together. The scorer boosts both cards when one is the key card.
 */
export const COMBO_PAIRS: readonly [string, string][] = [
  // Fusion enablers
  ['Instant Fusion', 'Thousand-Eyes Restrict'],
  ['Instant Fusion', 'Elder Entity Norden'],
  ['Red-Eyes Fusion', 'Red-Eyes Dark Dragoon'],
  ['Dark Calling', 'Evigishki Gustkraken'],
  // Synchro engines
  ['Rescue Cat', 'X-Saber Faultroll'],
  ['Junk Synchron', 'Junk Warrior'],
  ['Tuning', 'Junk Synchron'],
  // XYZ engines
  ['Tour Guide From the Underworld', 'Dante, Traveler of the Burning Abyss'],
  ['Bahamut Shark', 'Toadally Awesome'],
  // Draw engines
  ['Upstart Goblin', 'Chicken Game'],
  ['Pot of Desires', 'Pot of Extravagance'],
  ['Allure of Darkness', 'Dark World'],
  ['Danger! Nessie!', 'Danger! Mothman!'],
  // Protection combos
  ['Imperial Iron Wall', 'Macro Cosmos'],
  ['Solemn Judgment', 'Solemn Warning'],
  // Classic combos
  ['Catapult Turtle', 'Castle of Dark Illusions'],
  ['Ring of Destruction', 'Ring of Destruction'],
  ['Confiscation', 'The Forceful Sentry'],
  // Modern combos
  ['Branded Fusion', 'Albaz'],
  ['Branded in Red', 'Mirrorjade the Iceblade Dragon'],
  ['Crossout Designator', 'Called by the Grave'],
  ['Forbidden Droplet', 'Apollousa, Bow of the Goddess'],
  // Staple combos
  ['Ash Blossom & Joyous Spring', 'Called by the Grave'],
  ['Maxx "C"', 'Ash Blossom & Joyous Spring'],
  ['Nibiru, the Primal Being', 'Alpha, the Master of Beasts'],
]

/**
 * Effect keywords for smarter scoring.
 */
export const EFFECT_KEYWORDS = {
  /** Cards that destroy opponent's cards. */
  destroy: /destroy(?:s|ed)? (?:a |an |1 |all )?(?:card|monster|spell|trap)/i,
  /** Cards that negate effects. */
  negate: /negate/i,
  /** Cards that special summon from deck. */
  specialSummonDeck: /special summon .* from your deck/i,
  /** Cards that search/add to hand. */
  search: /add .* from your deck to your hand|search your deck/i,
  /** Cards that draw extra cards. */
  draw: /draw (?:\d+ |an? )?card/i,
  /** Cards that protect from targeting. */
  protectTarget: /cannot be (?:targeted|selected) by/i,
  /** Cards that protect from destruction. */
  protectDestroy: /cannot be destroyed (?:by battle|by card effect)/i,
  /** Cards that banish. */
  banish: /banish/i,
  /** Cards that prevent attacks. */
  preventAttack: /(?:cannot|can(?:'t|not)) attack/i,
  /** Cards that inflict burn damage. */
  burn: /inflict (?:\d+ )?damage/i,
  /** Cards that recover resources. */
  recover: /add .* from your (graveyard|banished|gy) to your hand/i,
  /** Cards that set from deck. */
  setFromDeck: /set .* from your deck/i,
  /** Cards that tribute opponent's monsters. */
  tribute: /tribute .* (?:monster|card) your opponent/i,
  /** Cards that control opponent's monsters. */
  steal: /take control/i,
  /** Cards that shuffle into deck. */
  shuffle: /shuffle .* into (?:the |your )?deck/i,
  /** Quick-play / chain effects. */
  quickEffect: /(?:during either player'?s turn|Quick Effect|when your opponent)/i,
} as const

/**
 * Archetype detection patterns. Maps archetype names to their playstyle.
 */
export const ARCHETYPE_STYLES: Record<string, 'aggro' | 'control' | 'combo' | 'stun'> = {
  // Aggro archetypes
  'Blackwing': 'aggro',
  'Six Samurai': 'aggro',
  'Infernity': 'aggro',
  'Mermail': 'aggro',
  'Wind-Up': 'aggro',
  'Hero': 'aggro',
  'Elemental HERO': 'aggro',
  'Destiny HERO': 'aggro',
  'Masked HERO': 'aggro',
  'Odd-Eyes': 'aggro',
  'Red-Eyes': 'aggro',
  'Blue-Eyes': 'aggro',
  'Cyber Dragon': 'aggro',
  'Galaxy': 'aggro',
  'Photon': 'aggro',
  'Trickstar': 'aggro',
  'Sky Striker': 'aggro',
  'Salamangreat': 'aggro',
  'Live Twin': 'aggro',
  'Evil Twin': 'aggro',
  'Unchained': 'aggro',
  'Kashtira': 'aggro',
  'Purrely': 'aggro',
  'Yubel': 'aggro',

  // Control archetypes
  'Eldlich': 'control',
  'Floowandereeze': 'control',
  'Mystic Mine': 'control',
  'True Draco': 'control',
  'Paleozoic': 'control',
  'Subterror': 'control',
  'Guru': 'control',
  'Altergeist': 'control',
  'Mayakashi': 'control',
  'Shaddoll': 'control',
  'Dogmatika': 'control',
  'Branded': 'control',
  'Despia': 'control',
  'Tearlaments': 'control',
  'Ishizu': 'control',

  // Combo archetypes
  'Synchron': 'combo',
  'Junk': 'combo',
  'Plant': 'combo',
  'Black Garden': 'combo',
  'Performage': 'combo',
  'Performapal': 'combo',
  'Magician': 'combo',
  'Odd-Eyes Magician': 'combo',
  'Pendulum': 'combo',
  'D/D/D': 'combo',
  'Qliphort': 'combo',
  'Metalfoes': 'combo',
  'Mekk-Knight': 'combo',
  'Orcust': 'combo',
  'Adamancipator': 'combo',
  'Prank-Kids': 'combo',
  'Code Talker': 'combo',
  'Mathmech': 'combo',
  'Ignister': 'combo',
  'Swordsoul': 'combo',
  'Tenyi': 'combo',
  'Vanquish Soul': 'combo',
  'Rescue-ACE': 'combo',
  'Fire King': 'combo',
  'Snake-Eye': 'combo',
  'Centur-Ion': 'combo',

  // Stun archetypes
  'Stun': 'stun',
  'Fossil Dyna': 'stun',
  'Inspector Boarder': 'stun',
  'Anti-Spell': 'stun',
  'Mystic Mine Stun': 'stun',
  'Macro Cosmos': 'stun',
  'Dimensional Fissure': 'stun',
  'Vanity': 'stun',
}

/**
 * Text patterns that indicate a card is generically useful (draw, search,
 * removal). Used to award the small generic-utility bonus.
 */
export const GENERIC_UTILITY_PATTERNS: readonly RegExp[] = [
  /draw \d+ card/i,
  /add \d+ .* from your deck to your hand/i,
  /search your deck/i,
  /destroy .* card/i,
  /special summon/i,
  /negate/i,
  /banish/i,
] as const

/**
 * Text patterns indicating a card supports another card by name or archetype.
 */
export const SUPPORT_PATTERNS: readonly RegExp[] = [
  /add .* to your hand/i,
  /special summon .* from your (deck|hand|graveyard|gy)/i,
  /equip/i,
  /target .* you control/i,
] as const

/**
 * Side deck staples: widely-played cards organized by purpose.
 * Used to auto-generate the side deck.
 */
export const SIDE_DECK_STAPLES = {
  antiMonster: [
    'Nibiru, the Primal Being',
    'Ghost Ogre & Snow Rabbit',
    'Ghost Mourner & Moonlit Chill',
    'D.D. Crow',
    'Effect Veiler',
    'Infinite Impermanence',
    'Book of Moon',
    'Floodgate Trap Hole',
  ],
  antiSpell: [
    'Mystical Space Typhoon',
    'Cosmic Cyclone',
    'Twin Twisters',
    'Harpie\'s Feather Duster',
    'Anti-Spell Fragrance',
    'Red Reboot',
  ],
  antiTrap: [
    'Harpie\'s Feather Duster',
    'Red Reboot',
    'Trap Dustshoot',
    'Evenly Matched',
    'Twin Twisters',
  ],
  goingSecond: [
    'Lightning Storm',
    'Raigeki',
    'Dark Hole',
    'Interrupted Kaiju Slumber',
    'Nibiru, the Primal Being',
    'Evenly Matched',
    'Lava Golem',
    'Kaiju',
  ],
  goingFirst: [
    'Solemn Judgment',
    'Solemn Warning',
    'Solemn Strike',
    'Imperial Order',
    'Rivalry of Warlords',
    'Gozen Match',
    'There Can Be Only One',
    'Macro Cosmos',
  ],
  boardBreakers: [
    'Lightning Storm',
    'Raigeki',
    'Dark Hole',
    'Interrupted Kaiju Slumber',
    'Knightmare Unicorn',
    'Accesscode Talker',
    'Zeus, Sky Thunder',
  ],
} as const
