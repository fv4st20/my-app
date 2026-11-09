// Comprehensive Fish Bestiary for Pirate Fishing
// Categorized by Rarity, Biome/Zone, Base Value, Weight, Reel Difficulty, and Pirate Lore.

export const ZONES = [
  {
    id: 'cove',
    name: "Smuggler's Cove",
    desc: "Calm, sunlit waters sheltered by pirate caves. Abundant with beginner fish.",
    unlockGold: 0,
    skyGradient: 'linear-gradient(to bottom, #7dd3fc 0%, #38bdf8 100%)',
    seaGradient: 'linear-gradient(to bottom, #0ea5e9 0%, #0369a1 100%)',
    waveColor: '#0ea5e9',
    waveColor2: '#0284c7',
    ambientEmoji: '☀️',
    badge: 'Beginner',
  },
  {
    id: 'reef',
    name: "Sunken Coral Reef",
    desc: "Vibrant tropical reefs blooming with exotic colors and swift predator fish.",
    unlockGold: 500,
    skyGradient: 'linear-gradient(to bottom, #fde047 0%, #f97316 70%, #ec4899 100%)',
    seaGradient: 'linear-gradient(to bottom, #06b6d4 0%, #0e7490 100%)',
    waveColor: '#06b6d4',
    waveColor2: '#0891b2',
    ambientEmoji: '🪸',
    badge: 'Intermediate',
  },
  {
    id: 'graveyard',
    name: "Shipwreck Graveyard",
    desc: "Haunted waters choked with rotting galleon masts and ghostly marine anomalies.",
    unlockGold: 5000,
    skyGradient: 'linear-gradient(to bottom, #334155 0%, #0f172a 100%)',
    seaGradient: 'linear-gradient(to bottom, #14532d 0%, #052e16 100%)',
    waveColor: '#16a34a',
    waveColor2: '#15803d',
    ambientEmoji: '⚓',
    badge: 'Dangerous',
  },
  {
    id: 'abyss',
    name: "The Abyssal Trench",
    desc: "Pitch black depths where sunlight never reaches. Only glowing monsters survive here.",
    unlockGold: 30000,
    skyGradient: 'linear-gradient(to bottom, #090d16 0%, #030712 100%)',
    seaGradient: 'linear-gradient(to bottom, #1e1b4b 0%, #020617 100%)',
    waveColor: '#6366f1',
    waveColor2: '#4338ca',
    ambientEmoji: '🏮',
    badge: 'Deep Sea',
  },
  {
    id: 'bermuda',
    name: "Bermuda Void Rift",
    desc: "A crack in the fabric of space-time. Home to mythical cosmic leviathans.",
    unlockGold: 150000,
    skyGradient: 'linear-gradient(to bottom, #2e1065 0%, #1e1b4b 50%, #4c0519 100%)',
    seaGradient: 'linear-gradient(to bottom, #701a75 0%, #18052e 100%)',
    waveColor: '#d946ef',
    waveColor2: '#a21caf',
    ambientEmoji: '🌀',
    badge: 'Eldritch End-Game',
  },
];

export const RARITIES = {
  Common: { name: 'Common', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' },
  Uncommon: { name: 'Uncommon', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e' },
  Rare: { name: 'Rare', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8' },
  Epic: { name: 'Epic', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: '#c084fc' },
  Legendary: { name: 'Legendary', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b' },
  Mythic: { name: 'Mythic', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.25)', border: '#f43f5e' },
};

export const FISH_DATABASE = [
  // --- COMMON FISH ---
  {
    id: 'anchovy',
    name: 'Silver Anchovy',
    rarity: 'Common',
    value: 8,
    weight: 120,
    zone: 'cove',
    difficulty: 1.0,
    icon: '🐟',
    lore: 'Tiny, salty schooling fish. Staple ration for starving pirate crews on long voyages.'
  },
  {
    id: 'sardine',
    name: 'Coastal Sardine',
    rarity: 'Common',
    value: 14,
    weight: 100,
    zone: 'cove',
    difficulty: 1.0,
    icon: '🐟',
    lore: 'Quick and oily. Excellent bait for bigger predatory fish in shallow coves.'
  },
  {
    id: 'herring',
    name: 'Atlantic Herring',
    rarity: 'Common',
    value: 22,
    weight: 85,
    zone: 'cove',
    difficulty: 1.1,
    icon: '🐟',
    lore: 'Known as the silver of the sea. Easily pickled in grog barrels.'
  },
  {
    id: 'sea_bass',
    name: 'Striped Sea Bass',
    rarity: 'Common',
    value: 35,
    weight: 70,
    zone: 'cove',
    difficulty: 1.15,
    icon: '🐟',
    lore: 'Fierce little fighter when hooked near rocky shorelines.'
  },
  {
    id: 'flounder',
    name: 'Sand Flounder',
    rarity: 'Common',
    value: 48,
    weight: 60,
    zone: 'cove',
    difficulty: 1.2,
    icon: '🐡',
    lore: 'Masters of sea-bed camouflage. Often stepped on by wading buccaneers.'
  },
  {
    id: 'flying_fish',
    name: 'Azure Flying Fish',
    rarity: 'Common',
    value: 65,
    weight: 50,
    zone: 'reef',
    difficulty: 1.25,
    icon: '🐠',
    lore: 'Glides across wave tops for hundreds of feet escaping reef predators.'
  },

  // --- UNCOMMON FISH ---
  {
    id: 'red_snapper',
    name: 'Ruby Snapper',
    rarity: 'Uncommon',
    value: 110,
    weight: 45,
    zone: 'reef',
    difficulty: 1.35,
    icon: '🐠',
    lore: 'Prized for its succulent red flesh. Tavern cooks pay top coin for these.'
  },
  {
    id: 'tuna',
    name: 'Yellowfin Tuna',
    rarity: 'Uncommon',
    value: 160,
    weight: 40,
    zone: 'reef',
    difficulty: 1.45,
    icon: '🐟',
    lore: 'A torpedo made of pure muscle. Strips line from flimsy reels in seconds.'
  },
  {
    id: 'pufferfish',
    name: 'Spiny Pufferfish',
    rarity: 'Uncommon',
    value: 220,
    weight: 35,
    zone: 'reef',
    difficulty: 1.5,
    icon: '🐡',
    lore: 'Inflates with venomous needles when threatened. Handled with thick leather gloves.'
  },
  {
    id: 'barracuda',
    name: 'Great Barracuda',
    rarity: 'Uncommon',
    value: 310,
    weight: 30,
    zone: 'reef',
    difficulty: 1.6,
    icon: '🦈',
    lore: 'Razor-sharp teeth and lightning speed. Attracted to shiny doubloons in the water.'
  },
  {
    id: 'electric_eel',
    name: 'Volt Moray',
    rarity: 'Uncommon',
    value: 420,
    weight: 25,
    zone: 'graveyard',
    difficulty: 1.7,
    icon: '⚡',
    lore: 'Discharges 500 volts when landed. Tends to scorch wooden ship decks.'
  },
  {
    id: 'mahi_mahi',
    name: 'Prismatic Dorado',
    rarity: 'Uncommon',
    value: 540,
    weight: 22,
    zone: 'reef',
    difficulty: 1.75,
    icon: '🐠',
    lore: 'Gleams like liquid gold and turquoise emeralds when leaping from the waves.'
  },

  // --- RARE FISH ---
  {
    id: 'swordfish',
    name: 'Broadbill Swordfish',
    rarity: 'Rare',
    value: 850,
    weight: 18,
    zone: 'reef',
    difficulty: 1.9,
    icon: '🗡️',
    lore: 'Armed with an organic rapier capable of puncturing dinghy hulls.'
  },
  {
    id: 'hammerhead',
    name: 'Reef Hammerhead',
    rarity: 'Rare',
    value: 1250,
    weight: 15,
    zone: 'graveyard',
    difficulty: 2.05,
    icon: '🦈',
    lore: 'Wide-set sensory eyes can locate sunken treasures buried deep under shifting sands.'
  },
  {
    id: 'giant_squid',
    name: 'Abyssal Calamari',
    rarity: 'Rare',
    value: 1800,
    weight: 12,
    zone: 'graveyard',
    difficulty: 2.15,
    icon: '🦑',
    lore: 'Huge sucker-covered tentacles that fight with violent suction and ink clouds.'
  },
  {
    id: 'anglerfish',
    name: 'Lantern Angler',
    rarity: 'Rare',
    value: 2600,
    weight: 10,
    zone: 'abyss',
    difficulty: 2.25,
    icon: '🏮',
    lore: 'Dangles a hypnotic bioluminescent orb to lure unsuspecting sea creatures into its gullet.'
  },
  {
    id: 'ghost_moray',
    name: 'Specter Moray',
    rarity: 'Rare',
    value: 3500,
    weight: 8,
    zone: 'graveyard',
    difficulty: 2.35,
    icon: '👻',
    lore: 'Translucent skin that passes through submerged rigging like a restless sea phantom.'
  },
  {
    id: 'crystal_nautilus',
    name: 'Diamond Nautilus',
    rarity: 'Rare',
    value: 4600,
    weight: 7,
    zone: 'abyss',
    difficulty: 2.4,
    icon: '🐚',
    lore: 'Its spiral shell is hardened by millennia of immense hydrostatic pressure into pure quartz.'
  },

  // --- EPIC FISH & SUNKEN RELICS ---
  {
    id: 'sunken_chest',
    name: 'Sunken Galleon Chest',
    rarity: 'Epic',
    value: 7000,
    weight: 6,
    zone: 'graveyard',
    difficulty: 2.5,
    icon: '📦',
    lore: 'Barnacle-encrusted iron strongbox containing lost Spanish doubloons and gemstones.'
  },
  {
    id: 'thresher_phantom',
    name: 'Phantom Thresher',
    rarity: 'Epic',
    value: 9500,
    weight: 5,
    zone: 'graveyard',
    difficulty: 2.65,
    icon: '🦈',
    lore: 'Its elongated whip-like tail generates sonic shockwaves underwater.'
  },
  {
    id: 'obsidian_crab',
    name: 'Volcanic Obsidian Crab',
    rarity: 'Epic',
    value: 13000,
    weight: 4.5,
    zone: 'abyss',
    difficulty: 2.75,
    icon: '🦀',
    lore: 'Carapace forged from cooled hydrothermal magma. Strong enough to deflect cannonballs.'
  },
  {
    id: 'abyssal_ray',
    name: 'Bioluminescent Manta',
    rarity: 'Epic',
    value: 18000,
    weight: 4,
    zone: 'abyss',
    difficulty: 2.85,
    icon: '🛸',
    lore: 'Glides silently through the eternal black trench like a living celestial spaceship.'
  },
  {
    id: 'cursed_skeleton',
    name: 'Cursed Leviathan Bonefish',
    rarity: 'Epic',
    value: 24000,
    weight: 3.5,
    zone: 'graveyard',
    difficulty: 2.95,
    icon: '💀',
    lore: 'An undead sea serpent animated by old pirate curses. It still hungers even without flesh.'
  },
  {
    id: 'magma_drake',
    name: 'Thermal Sea Drake',
    rarity: 'Epic',
    value: 32000,
    weight: 3,
    zone: 'abyss',
    difficulty: 3.05,
    icon: '🐉',
    lore: 'Breathes superheated boiling steam bubbles that scald any fishing line.'
  },

  // --- LEGENDARY SEA TITANS ---
  {
    id: 'golden_leviathan',
    name: 'The Golden Leviathan',
    rarity: 'Legendary',
    value: 50000,
    weight: 2.2,
    zone: 'reef',
    difficulty: 3.15,
    icon: '👑',
    lore: 'Said to be coated in the molten gold of hundred sunken treasure fleets.'
  },
  {
    id: 'megalodon',
    name: 'Primeval Megalodon',
    rarity: 'Legendary',
    value: 75000,
    weight: 1.8,
    zone: 'abyss',
    difficulty: 3.25,
    icon: '🦈',
    lore: 'Ancient apex predator thought extinct for millions of years. Can swallow a sloop whole.'
  },
  {
    id: 'siren_oyster',
    name: "Siren's Heart Oyster",
    rarity: 'Legendary',
    value: 110000,
    weight: 1.5,
    zone: 'cove',
    difficulty: 3.3,
    icon: '🦪',
    lore: 'Houses a massive iridescent black pearl whispered to grant control over sea storms.'
  },
  {
    id: 'prismatic_serpent',
    name: 'Prismatic World Serpent',
    rarity: 'Legendary',
    value: 160000,
    weight: 1.2,
    zone: 'bermuda',
    difficulty: 3.4,
    icon: '🐍',
    lore: 'A serpent whose scales refract every color in the spectrum, causing mirages on water.'
  },
  {
    id: 'poseidon_steed',
    name: "Neptune's War Hippocampus",
    rarity: 'Legendary',
    value: 230000,
    weight: 1.0,
    zone: 'bermuda',
    difficulty: 3.45,
    icon: '🐴',
    lore: 'Mythological warhorse of the ocean gods, with hooves that command tidal waves.'
  },

  // --- MYTHIC & ELDRITCH HORRORS ---
  {
    id: 'kraken_tentacle',
    name: "Arch-Kraken's Grasping Arm",
    rarity: 'Mythic',
    value: 350000,
    weight: 0.7,
    zone: 'abyss',
    difficulty: 3.55,
    icon: '🐙',
    lore: 'A single tentacle of the titan that dragged countless armadas to the sea floor.'
  },
  {
    id: 'davy_lockbox',
    name: "Davy Jones' Lost Chest",
    rarity: 'Mythic',
    value: 550000,
    weight: 0.5,
    zone: 'graveyard',
    difficulty: 3.65,
    icon: '🗝️',
    lore: 'Contains the beating heart and eldritch secrets of the eternal Ferryman of the Dead.'
  },
  {
    id: 'void_devourer',
    name: 'Cosmic Rift Ray',
    rarity: 'Mythic',
    value: 900000,
    weight: 0.35,
    zone: 'bermuda',
    difficulty: 3.75,
    icon: '🌌',
    lore: 'Swims through gravitational ripples between dimensions, feasting on lost ghost ships.'
  },
  {
    id: 'behemoth_maw',
    name: 'Cthulhu Abyssal Broodling',
    rarity: 'Mythic',
    value: 1500000,
    weight: 0.2,
    zone: 'bermuda',
    difficulty: 3.85,
    icon: '👁️',
    lore: 'Stares into your soul with a thousand unblinking eyes. To hook it is to invite madness.'
  },
  {
    id: 'bermuda_singularity',
    name: 'Heart of the Bermuda Vortex',
    rarity: 'Mythic',
    value: 3000000,
    weight: 0.1,
    zone: 'bermuda',
    difficulty: 4.0,
    icon: '🌀',
    lore: 'The very origin of all nautical disappearances. Radiates raw limitless pirate infamy.'
  }
];
