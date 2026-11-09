// Equipment, Upgrades, Fleet Ships, and Ascension Perks

export const RODS = [
  {
    id: 'rod_1',
    name: 'Old Driftwood Cane',
    tier: 1,
    cost: 0,
    power: 7, // Reel progress gained per click
    drainReduction: 0, // % drain reduced
    desc: 'Wobbly piece of driftwood tied with hemp string. Gets the job done in quiet coves.',
    badge: 'T1 Starter',
    color: '#94a3b8'
  },
  {
    id: 'rod_2',
    name: 'Reinforced Bamboo Rod',
    tier: 2,
    cost: 300,
    power: 12,
    drainReduction: 0.15,
    desc: 'Flexible tropical bamboo wrapped with brass rings. Makes reeling snappy.',
    badge: 'T2 Bamboo',
    color: '#22c55e'
  },
  {
    id: 'rod_3',
    name: 'Deepwater Ironbound Rod',
    tier: 3,
    cost: 2500,
    power: 20,
    drainReduction: 0.30,
    desc: 'Forged with pig iron and braided steel wire. Strong enough to pull reef sharks.',
    badge: 'T3 Ironbound',
    color: '#38bdf8'
  },
  {
    id: 'rod_4',
    name: 'Titanium Harpoon Caster',
    tier: 4,
    cost: 18000,
    power: 32,
    drainReduction: 0.45,
    desc: 'Steam-assisted pneumatic winch that wrenches deep sea horrors to the surface.',
    badge: 'T4 Harpoon',
    color: '#c084fc'
  },
  {
    id: 'rod_5',
    name: 'Kraken-Bone Greatcaster',
    tier: 5,
    cost: 95000,
    power: 50,
    drainReduction: 0.60,
    desc: 'Carved from the calcified beak of a colossal cephalopod. Thrums with abyssal dread.',
    badge: 'T5 Legendary',
    color: '#f59e0b'
  },
  {
    id: 'rod_6',
    name: "Neptune's Godcaster Trident",
    tier: 6,
    cost: 500000,
    power: 80,
    drainReduction: 0.75,
    desc: 'Blessed by the sea deities. Can tame the fiercest vortex entities with effortless majesty.',
    badge: 'T6 Mythic',
    color: '#f43f5e'
  }
];

export const BAITS = [
  {
    id: 'bait_1',
    name: 'Stale Breadcrumbs',
    tier: 1,
    cost: 0,
    luckBonus: 0, // baseline
    rareBonus: 0,
    desc: 'Soggy ship biscuits. Good enough to entice hungry shore fish.',
    badge: 'Standard',
    color: '#94a3b8'
  },
  {
    id: 'bait_2',
    name: 'Bioluminescent Glow Worms',
    tier: 2,
    cost: 200,
    luckBonus: 20,
    rareBonus: 10,
    desc: 'Glows softly underwater. Uncommonly appetizing to reef predators.',
    badge: 'Glow Bait',
    color: '#22c55e'
  },
  {
    id: 'bait_3',
    name: 'Chum & Squid Guts',
    tier: 3,
    cost: 1800,
    luckBonus: 50,
    rareBonus: 25,
    desc: 'A pungent slurry that drives sharks and giant squids into a feeding frenzy.',
    badge: 'Blood Chum',
    color: '#38bdf8'
  },
  {
    id: 'bait_4',
    name: 'Deepsea Abyssal Lantern Oil',
    tier: 4,
    cost: 14000,
    luckBonus: 90,
    rareBonus: 50,
    desc: 'Extracted from anglerfish bulbs. Irresistible to sunken chests and abyssal rays.',
    badge: 'Deep Lantern',
    color: '#c084fc'
  },
  {
    id: 'bait_5',
    name: "Siren's Sweet Ambrosia",
    tier: 5,
    cost: 80000,
    luckBonus: 150,
    rareBonus: 85,
    desc: 'Enchanted honeydew said to entice legendary sea kings and mythical leviathans.',
    badge: 'Siren Lure',
    color: '#f59e0b'
  },
  {
    id: 'bait_6',
    name: 'Heart of the Void Fragment',
    tier: 6,
    cost: 450000,
    luckBonus: 250,
    rareBonus: 150,
    desc: 'Pulsing eldritch cosmic matter that summons ancient god-beasts from the void.',
    badge: 'Eldritch Void',
    color: '#f43f5e'
  }
];

export const SHIPS = [
  {
    id: 'ship_1',
    name: 'Pirate Dinghy',
    tier: 1,
    cost: 0,
    cargoCap: 20,
    goldBonus: 0,
    desc: 'A wooden rowboat. Limited hold capacity.'
  },
  {
    id: 'ship_2',
    name: 'Blackwater Sloop',
    tier: 2,
    cost: 600,
    cargoCap: 45,
    goldBonus: 0.05, // +5%
    desc: 'Swift single-mast vessel with extra barrels for fresh fish.'
  },
  {
    id: 'ship_3',
    name: 'Corsair Schooner',
    tier: 3,
    cost: 4500,
    cargoCap: 90,
    goldBonus: 0.12, // +12%
    desc: 'Twin-masted raider equipped with salt cellars.'
  },
  {
    id: 'ship_4',
    name: 'Ironclad Brigantine',
    tier: 4,
    cost: 35000,
    cargoCap: 180,
    goldBonus: 0.25, // +25%
    desc: 'Armored pirate gunship capable of hauling massive deep-sea hauls.'
  },
  {
    id: 'ship_5',
    name: 'Sovereign Galleon',
    tier: 5,
    cost: 200000,
    cargoCap: 350,
    goldBonus: 0.40, // +40%
    desc: 'A fortress of the high seas. Vast cargo hold lined with gold.'
  },
  {
    id: 'ship_6',
    name: 'Ghost Dreadnought',
    tier: 6,
    cost: 1000000,
    cargoCap: 800,
    goldBonus: 0.75, // +75%
    desc: 'Spectral flagship defying gravity. Nearly bottomless phantom cargo hold.'
  }
];

export const CAPTAIN_PERKS = [
  {
    id: 'perk_greed',
    name: "Smuggler's Greed",
    icon: 'Coins',
    costPerLevel: 1,
    maxLevel: 10,
    desc: '+15% Gold value for all sold fish per level.',
    getBonus: (lvl) => lvl * 0.15
  },
  {
    id: 'perk_power',
    name: 'Iron Wrist',
    icon: 'Anchor',
    costPerLevel: 1,
    maxLevel: 10,
    desc: '+10 Base Reel Power on all rods per level.',
    getBonus: (lvl) => lvl * 10
  },
  {
    id: 'perk_crew',
    name: 'Ghostly Deckhands',
    icon: 'Ship',
    costPerLevel: 2,
    maxLevel: 5,
    desc: 'Automated crew catches fish 20% faster per level.',
    getBonus: (lvl) => lvl * 0.20
  },
  {
    id: 'perk_double',
    name: "Davy Jones' Favor",
    icon: 'Skull',
    costPerLevel: 3,
    maxLevel: 5,
    desc: '+6% flat chance to hook double catch of any fish per level.',
    getBonus: (lvl) => lvl * 0.06
  }
];
