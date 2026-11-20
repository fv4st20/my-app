import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Anchor,
  Fish,
  Ship,
  ShoppingCart,
  DollarSign,
  Coins,
  Sparkles,
  Compass,
  Skull,
  Volume2,
  VolumeX,
  BookOpen,
  Trophy,
  ArrowLeft,
  Star,
  Zap
} from 'lucide-react';
import { ZONES, RARITIES, FISH_DATABASE } from './data/fishDatabase';
import { RODS, BAITS, SHIPS, CAPTAIN_PERKS } from './data/equipment';
import { sounds } from './utils/soundEffects';
import './index.css';

const SAVE_KEY = 'pirate_fishing_save_v3';

const DEFAULT_PERK_LEVELS = {
  perk_greed: 0,
  perk_power: 0,
  perk_crew: 0,
  perk_double: 0,
};

function isFiniteNonNegative(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function loadInitialSave() {
  const defaults = {
    gold: 0,
    lifetimeGold: 0,
    allTimeGold: 0,
    totalFishCaught: 0,
    highestFishValue: 0,
    cargo: [],
    equippedRodId: 'rod_1',
    unlockedRods: ['rod_1'],
    equippedBaitId: 'bait_1',
    unlockedBaits: ['bait_1'],
    equippedShipId: 'ship_1',
    unlockedShips: ['ship_1'],
    crewCount: 0,
    currentZoneId: 'cove',
    unlockedZones: ['cove'],
    infamySkulls: 0,
    totalAscensions: 0,
    perkLevels: { ...DEFAULT_PERK_LEVELS },
    bestiary: {},
    soundMuted: false,
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return defaults;
    const data = JSON.parse(saved);
    if (!isPlainObject(data)) return defaults;

    const validRodIds = new Set(RODS.map(r => r.id));
    const validBaitIds = new Set(BAITS.map(b => b.id));
    const validShipIds = new Set(SHIPS.map(s => s.id));
    const validZoneIds = new Set(ZONES.map(z => z.id));

    const safeUnlockedRods = Array.isArray(data.unlockedRods)
      ? Array.from(new Set(['rod_1', ...data.unlockedRods.filter(id => validRodIds.has(id))]))
      : ['rod_1'];
    const safeUnlockedBaits = Array.isArray(data.unlockedBaits)
      ? Array.from(new Set(['bait_1', ...data.unlockedBaits.filter(id => validBaitIds.has(id))]))
      : ['bait_1'];
    const safeUnlockedShips = Array.isArray(data.unlockedShips)
      ? Array.from(new Set(['ship_1', ...data.unlockedShips.filter(id => validShipIds.has(id))]))
      : ['ship_1'];
    const safeUnlockedZones = Array.isArray(data.unlockedZones)
      ? Array.from(new Set(['cove', ...data.unlockedZones.filter(id => validZoneIds.has(id))]))
      : ['cove'];

    const safeCargo = Array.isArray(data.cargo)
      ? data.cargo.filter(item => isPlainObject(item) && typeof item.id === 'string' && isFiniteNonNegative(item.value)).slice(0, 800)
      : [];

    const safePerkLevels = { ...DEFAULT_PERK_LEVELS };
    if (isPlainObject(data.perkLevels)) {
      for (const perk of CAPTAIN_PERKS) {
        const lvl = data.perkLevels[perk.id];
        if (isFiniteNonNegative(lvl)) {
          safePerkLevels[perk.id] = Math.min(perk.maxLevel, Math.floor(lvl));
        }
      }
    }

    const safeBestiary = {};
    if (isPlainObject(data.bestiary)) {
      for (const fish of FISH_DATABASE) {
        const entry = data.bestiary[fish.id];
        if (isPlainObject(entry) && isFiniteNonNegative(entry.count) && entry.count > 0) {
          safeBestiary[fish.id] = {
            count: Math.floor(entry.count),
            maxWeight: isFiniteNonNegative(entry.maxWeight) ? entry.maxWeight : 0,
            firstCaught: isFiniteNonNegative(entry.firstCaught) ? entry.firstCaught : Date.now(),
          };
        }
      }
    }

    return {
      gold: isFiniteNonNegative(data.gold) ? Math.floor(data.gold) : 0,
      lifetimeGold: isFiniteNonNegative(data.lifetimeGold) ? Math.floor(data.lifetimeGold) : 0,
      allTimeGold: isFiniteNonNegative(data.allTimeGold) ? Math.floor(data.allTimeGold) : 0,
      totalFishCaught: isFiniteNonNegative(data.totalFishCaught) ? Math.floor(data.totalFishCaught) : 0,
      highestFishValue: isFiniteNonNegative(data.highestFishValue) ? Math.floor(data.highestFishValue) : 0,
      cargo: safeCargo,
      equippedRodId: validRodIds.has(data.equippedRodId) && safeUnlockedRods.includes(data.equippedRodId) ? data.equippedRodId : 'rod_1',
      unlockedRods: safeUnlockedRods,
      equippedBaitId: validBaitIds.has(data.equippedBaitId) && safeUnlockedBaits.includes(data.equippedBaitId) ? data.equippedBaitId : 'bait_1',
      unlockedBaits: safeUnlockedBaits,
      equippedShipId: validShipIds.has(data.equippedShipId) && safeUnlockedShips.includes(data.equippedShipId) ? data.equippedShipId : 'ship_1',
      unlockedShips: safeUnlockedShips,
      crewCount: isFiniteNonNegative(data.crewCount) ? Math.floor(data.crewCount) : 0,
      currentZoneId: validZoneIds.has(data.currentZoneId) && safeUnlockedZones.includes(data.currentZoneId) ? data.currentZoneId : 'cove',
      unlockedZones: safeUnlockedZones,
      infamySkulls: isFiniteNonNegative(data.infamySkulls) ? Math.floor(data.infamySkulls) : 0,
      totalAscensions: isFiniteNonNegative(data.totalAscensions) ? Math.floor(data.totalAscensions) : 0,
      perkLevels: safePerkLevels,
      bestiary: safeBestiary,
      soundMuted: typeof data.soundMuted === 'boolean' ? data.soundMuted : false,
    };
  } catch {
    return defaults;
  }
}

function rollFishForZone(zoneId, bait) {
  const available = FISH_DATABASE.filter(f => f.zone === zoneId || (zoneId === 'bermuda' && f.rarity === 'Mythic'));
  if (available.length === 0) {
    return { ...FISH_DATABASE[0], weightLbs: 2.0, caughtAt: Date.now() };
  }

  const luck = bait?.luckBonus || 0;
  const rareLuck = bait?.rareBonus || 0;

  const weightedList = available.map(f => {
    let weight = f.weight;
    if (f.rarity === 'Uncommon') weight += luck * 0.15;
    if (f.rarity === 'Rare') weight += luck * 0.3 + rareLuck * 0.2;
    if (f.rarity === 'Epic') weight += luck * 0.15 + rareLuck * 0.4;
    if (f.rarity === 'Legendary') weight += luck * 0.08 + rareLuck * 0.3;
    if (f.rarity === 'Mythic') weight += luck * 0.04 + rareLuck * 0.25;
    return { fish: f, weight: Math.max(0.1, weight) };
  });

  const totalWeight = weightedList.reduce((sum, item) => sum + item.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const item of weightedList) {
    if (rand < item.weight) {
      const baseLbs = item.fish.value * 0.08 + 1.2;
      const actualWeight = Number((baseLbs * (0.8 + Math.random() * 0.5)).toFixed(1));
      return { ...item.fish, weightLbs: actualWeight, caughtAt: Date.now() + Math.random() };
    }
    rand -= item.weight;
  }
  return { ...available[0], weightLbs: 2.5, caughtAt: Date.now() + Math.random() };
}

function App() {
  const [initialSave] = useState(loadInitialSave);

  const [gold, setGold] = useState(initialSave.gold);
  const [lifetimeGold, setLifetimeGold] = useState(initialSave.lifetimeGold);
  const [allTimeGold, setAllTimeGold] = useState(initialSave.allTimeGold);
  const [totalFishCaught, setTotalFishCaught] = useState(initialSave.totalFishCaught);
  const [highestFishValue, setHighestFishValue] = useState(initialSave.highestFishValue);

  const [cargo, setCargo] = useState(initialSave.cargo);
  const [equippedRodId, setEquippedRodId] = useState(initialSave.equippedRodId);
  const [unlockedRods, setUnlockedRods] = useState(initialSave.unlockedRods);
  const [equippedBaitId, setEquippedBaitId] = useState(initialSave.equippedBaitId);
  const [unlockedBaits, setUnlockedBaits] = useState(initialSave.unlockedBaits);
  const [equippedShipId, setEquippedShipId] = useState(initialSave.equippedShipId);
  const [unlockedShips, setUnlockedShips] = useState(initialSave.unlockedShips);

  const [crewCount, setCrewCount] = useState(initialSave.crewCount);
  const [currentZoneId, setCurrentZoneId] = useState(initialSave.currentZoneId);
  const [unlockedZones, setUnlockedZones] = useState(initialSave.unlockedZones);

  // Prestige / Infamy Ascension System
  const [infamySkulls, setInfamySkulls] = useState(initialSave.infamySkulls);
  const [totalAscensions, setTotalAscensions] = useState(initialSave.totalAscensions);
  const [perkLevels, setPerkLevels] = useState(initialSave.perkLevels);

  // Compendium Bestiary
  const [bestiary, setBestiary] = useState(initialSave.bestiary);

  // Active UI State
  const [activeTab, setActiveTab] = useState('cargo');
  const [bestiaryFilter, setBestiaryFilter] = useState('all');
  const [soundMuted, setSoundMuted] = useState(initialSave.soundMuted);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [recentCatchAlert, setRecentCatchAlert] = useState(null);

  // User Auth & Global Leaderboard State
  const [authUser, setAuthUser] = useState(null);
  const [pirateLeaderboard, setPirateLeaderboard] = useState([]);
  const [submittingLeaderboard, setSubmittingLeaderboard] = useState(false);
  const [leaderboardNotice, setLeaderboardNotice] = useState(null);

  // Fishing Minigame State: 'idle' | 'waiting' | 'reeling' | 'caught' | 'lost'
  const [fishState, setFishState] = useState('idle');
  const [reelProgress, setReelProgress] = useState(0);
  const [currentBite, setCurrentBite] = useState(null);
  const [zoneNotice, setZoneNotice] = useState(null);

  const reelTimerRef = useRef(null);
  const castTimerRef = useRef(null);
  const finishTimerRef = useRef(null);
  const zoneTimerRef = useRef(null);
  const cargoRef = useRef(initialSave.cargo);
  const fishStateRef = useRef('idle');
  const reelProgressRef = useRef(0);
  const challengeRef = useRef(null);

  // Derived Equipment Objects
  const currentRod = useMemo(() => RODS.find(r => r.id === equippedRodId) || RODS[0], [equippedRodId]);
  const currentBait = useMemo(() => BAITS.find(b => b.id === equippedBaitId) || BAITS[0], [equippedBaitId]);
  const currentShip = useMemo(() => SHIPS.find(s => s.id === equippedShipId) || SHIPS[0], [equippedShipId]);
  const currentZone = useMemo(() => ZONES.find(z => z.id === currentZoneId) || ZONES[0], [currentZoneId]);

  const goldMultiplier = useMemo(() => {
    const infamyBonus = totalAscensions * 0.25;
    const greedBonus = (perkLevels.perk_greed || 0) * 0.15;
    const shipBonus = currentShip.goldBonus || 0;
    return Number((1 + infamyBonus + greedBonus + shipBonus).toFixed(2));
  }, [totalAscensions, perkLevels.perk_greed, currentShip.goldBonus]);

  // Keep refs synchronized outside render
  useEffect(() => {
    cargoRef.current = cargo;
  }, [cargo]);

  useEffect(() => {
    fishStateRef.current = fishState;
  }, [fishState]);

  useEffect(() => {
    sounds.muted = soundMuted;
  }, [soundMuted]);

  const clearFishingTimers = useCallback(() => {
    if (reelTimerRef.current) {
      clearInterval(reelTimerRef.current);
      reelTimerRef.current = null;
    }
    if (castTimerRef.current) {
      clearTimeout(castTimerRef.current);
      castTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const fetchPirateLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/pirate-fishing?limit=25', {
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.leaderboard)) {
          setPirateLeaderboard(data.leaderboard);
        }
      }
    } catch {
      // Network error ignored
    }
  }, []);

  const requestPirateChallenge = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'pirate-fishing' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.challenge) {
          challengeRef.current = data.challenge;
          return data.challenge;
        }
      }
    } catch {
      // Offline or unauthenticated
    }
    return null;
  }, []);

  // Fetch authenticated user, challenge token & leaderboard, and clean up timers on unmount
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && data.authenticated && data.user) {
          setAuthUser(data.user);
        }
      })
      .catch(() => {});

    requestPirateChallenge();

    fetch('/api/leaderboard/pirate-fishing?limit=25', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && data.success && Array.isArray(data.leaderboard)) {
          setPirateLeaderboard(data.leaderboard);
        }
      })
      .catch(() => {});

    return () => {
      clearFishingTimers();
      if (zoneTimerRef.current) {
        clearTimeout(zoneTimerRef.current);
        zoneTimerRef.current = null;
      }
      sounds.dispose();
    };
  }, [clearFishingTimers, requestPirateChallenge]);

  // Auto-save to LocalStorage
  useEffect(() => {
    try {
      const stateToSave = {
        gold,
        lifetimeGold,
        allTimeGold,
        totalFishCaught,
        highestFishValue,
        cargo,
        equippedRodId,
        unlockedRods,
        equippedBaitId,
        unlockedBaits,
        equippedShipId,
        unlockedShips,
        crewCount,
        currentZoneId,
        unlockedZones,
        infamySkulls,
        totalAscensions,
        perkLevels,
        bestiary,
        soundMuted,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Storage quota or privacy mode restriction
    }
  }, [
    gold,
    lifetimeGold,
    allTimeGold,
    totalFishCaught,
    highestFishValue,
    cargo,
    equippedRodId,
    unlockedRods,
    equippedBaitId,
    unlockedBaits,
    equippedShipId,
    unlockedShips,
    crewCount,
    currentZoneId,
    unlockedZones,
    infamySkulls,
    totalAscensions,
    perkLevels,
    bestiary,
    soundMuted,
  ]);

  const submitToGlobalLeaderboard = async () => {
    if (!isFiniteNonNegative(allTimeGold) || allTimeGold <= 0 || submittingLeaderboard) return;
    setSubmittingLeaderboard(true);
    setLeaderboardNotice(null);

    try {
      let activeChallenge = challengeRef.current;
      if (!activeChallenge) {
        activeChallenge = await requestPirateChallenge();
      }
      challengeRef.current = null;

      const res = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: 'pirate-fishing',
          score: Math.min(100000000, Math.floor(allTimeGold)),
          challenge: activeChallenge,
          username: authUser ? authUser.username : 'Guest_Captain',
          details: { infamy: totalAscensions, caught: totalFishCaught }
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        setLeaderboardNotice(`⚓ Glory Broadcast! You hold Global Rank #${data.rank || 1}!`);
        fetchPirateLeaderboard();
      } else {
        setLeaderboardNotice(data?.reason || 'Broadcast failed.');
      }
    } catch {
      setLeaderboardNotice('Network connection error.');
    } finally {
      setSubmittingLeaderboard(false);
      requestPirateChallenge();
    }
  };

  const toggleSound = () => {
    setSoundMuted(prev => !prev);
  };

  // Handle successful fish catch (idempotent against duplicate triggers)
  const handleCatchSuccess = useCallback((caughtFish) => {
    if (fishStateRef.current !== 'reeling' || !caughtFish) return;
    fishStateRef.current = 'caught';
    if (reelTimerRef.current) {
      clearInterval(reelTimerRef.current);
      reelTimerRef.current = null;
    }

    setFishState('caught');
    sounds.playCatch(caughtFish.rarity);

    const doublePerkChance = (perkLevels.perk_double || 0) * 0.06;
    const isDouble = Math.random() < doublePerkChance;
    const candidates = isDouble ? [caughtFish, { ...caughtFish, caughtAt: Date.now() + 1 }] : [caughtFish];

    const availableSlots = Math.max(0, currentShip.cargoCap - cargoRef.current.length);
    const addedFish = candidates.slice(0, availableSlots);
    const addedCount = addedFish.length;

    if (addedCount > 0) {
      setCargo(c => {
        const slots = Math.max(0, currentShip.cargoCap - c.length);
        return [...c, ...candidates.slice(0, slots)];
      });

      setTotalFishCaught(prev => prev + addedCount);
      setHighestFishValue(prev => Math.max(prev, caughtFish.value));

      setBestiary(prev => {
        const existing = prev[caughtFish.id] || { count: 0, maxWeight: 0, firstCaught: Date.now() };
        return {
          ...prev,
          [caughtFish.id]: {
            count: existing.count + addedCount,
            maxWeight: Math.max(existing.maxWeight, caughtFish.weightLbs),
            firstCaught: existing.firstCaught || Date.now(),
          }
        };
      });
    }

    setRecentCatchAlert({
      fish: caughtFish,
      isDouble: addedCount > 1,
    });

    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    finishTimerRef.current = setTimeout(() => {
      fishStateRef.current = 'idle';
      setFishState('idle');
      setRecentCatchAlert(null);
    }, 1800);
  }, [currentShip.cargoCap, perkLevels.perk_double]);

  const castLine = useCallback(() => {
    if (fishStateRef.current !== 'idle') return;
    if (cargoRef.current.length >= currentShip.cargoCap) {
      setActiveTab('cargo');
      return;
    }

    sounds.playCast();
    fishStateRef.current = 'waiting';
    setFishState('waiting');

    const waitTime = 1500 + Math.random() * 2300;
    if (castTimerRef.current) clearTimeout(castTimerRef.current);
    castTimerRef.current = setTimeout(() => {
      if (fishStateRef.current !== 'waiting') return;
      const rolled = rollFishForZone(currentZoneId, currentBait);
      setCurrentBite(rolled);
      reelProgressRef.current = 35;
      setReelProgress(35);
      fishStateRef.current = 'reeling';
      setFishState('reeling');
      sounds.playBite();
    }, waitTime);
  }, [currentBait, currentShip.cargoCap, currentZoneId]);

  const reelClick = useCallback(() => {
    if (fishStateRef.current !== 'reeling' || !currentBite) return;

    sounds.playReelClick();
    const rodPower = currentRod.power + (perkLevels.perk_power || 0) * 10;
    const nextP = Math.min(100, reelProgressRef.current + rodPower);
    reelProgressRef.current = nextP;
    setReelProgress(nextP);

    if (nextP >= 100) {
      handleCatchSuccess(currentBite);
    }
  }, [currentBite, currentRod.power, handleCatchSuccess, perkLevels.perk_power]);

  // Reeling Drain Loop (no impure state-updater side effects)
  useEffect(() => {
    if (fishState !== 'reeling' || !currentBite) {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
      return;
    }

    reelTimerRef.current = setInterval(() => {
      if (fishStateRef.current !== 'reeling') return;
      const drainReduction = currentRod.drainReduction || 0;
      const diff = currentBite.difficulty || 1.0;
      const drainRate = 2.2 * diff * (1 - drainReduction);

      const nextP = Math.max(0, reelProgressRef.current - drainRate);
      reelProgressRef.current = nextP;
      setReelProgress(nextP);

      if (nextP <= 0) {
        if (reelTimerRef.current) {
          clearInterval(reelTimerRef.current);
          reelTimerRef.current = null;
        }
        fishStateRef.current = 'lost';
        setFishState('lost');
        if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
        finishTimerRef.current = setTimeout(() => {
          fishStateRef.current = 'idle';
          setFishState('idle');
        }, 1400);
      }
    }, 100);

    return () => {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
    };
  }, [fishState, currentBite, currentRod.drainReduction]);

  // Spacebar Desktop Support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'button') return;
        if (fishStateRef.current === 'idle') {
          e.preventDefault();
          castLine();
        } else if (fishStateRef.current === 'reeling') {
          e.preventDefault();
          reelClick();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [castLine, reelClick]);

  // Passive Crew Auto-Fishing (scales properly with crewCount & perk_crew)
  useEffect(() => {
    if (crewCount <= 0) return;

    const speedMultiplier = crewCount * (1 + (perkLevels.perk_crew || 0) * 0.2);
    const intervalTime = Math.max(1000, Math.floor(10000 / speedMultiplier));
    const batchPerTick = Math.max(1, Math.floor(speedMultiplier / 10));

    const interval = setInterval(() => {
      const slotsLeft = currentShip.cargoCap - cargoRef.current.length;
      if (slotsLeft <= 0) return;

      const catchCount = Math.min(slotsLeft, batchPerTick);
      const caughtBatch = [];
      for (let i = 0; i < catchCount; i++) {
        caughtBatch.push(rollFishForZone(currentZoneId, currentBait));
      }

      setCargo(prevCargo => {
        const capLeft = Math.max(0, currentShip.cargoCap - prevCargo.length);
        return [...prevCargo, ...caughtBatch.slice(0, capLeft)];
      });

      setBestiary(b => {
        const next = { ...b };
        for (const autoFish of caughtBatch) {
          const ex = next[autoFish.id] || { count: 0, maxWeight: 0, firstCaught: Date.now() };
          next[autoFish.id] = {
            count: ex.count + 1,
            maxWeight: Math.max(ex.maxWeight, autoFish.weightLbs),
            firstCaught: ex.firstCaught || Date.now(),
          };
        }
        return next;
      });

      setTotalFishCaught(t => t + caughtBatch.length);
      const maxVal = caughtBatch.reduce((m, f) => Math.max(m, f.value), 0);
      setHighestFishValue(h => Math.max(h, maxVal));
    }, intervalTime);

    return () => clearInterval(interval);
  }, [crewCount, currentZoneId, currentBait, perkLevels.perk_crew, currentShip.cargoCap]);

  // Sell Cargo
  const sellCargo = () => {
    if (cargo.length === 0) return;

    const baseSum = cargo.reduce((sum, f) => sum + f.value, 0);
    const finalEarnings = Math.floor(baseSum * goldMultiplier);

    sounds.playCoin();
    setGold(g => g + finalEarnings);
    setLifetimeGold(lg => lg + finalEarnings);
    setAllTimeGold(ag => ag + finalEarnings);
    setCargo([]);
  };

  // Unlock / Travel to Zone
  const handleZoneAction = (zone) => {
    if (unlockedZones.includes(zone.id)) {
      setCurrentZoneId(zone.id);
      setZoneNotice(null);
      return;
    }

    if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
    if (gold >= zone.unlockGold) {
      setGold(g => g - zone.unlockGold);
      setUnlockedZones(u => [...u, zone.id]);
      setCurrentZoneId(zone.id);
      setZoneNotice(`Chartered expedition to ${zone.name}!`);
      sounds.playCoin();
      zoneTimerRef.current = setTimeout(() => setZoneNotice(null), 3000);
    } else {
      setZoneNotice(`Need ${zone.unlockGold.toLocaleString()} G to unlock ${zone.name}`);
      zoneTimerRef.current = setTimeout(() => setZoneNotice(null), 3000);
    }
  };

  const handleBuyRod = (rod) => {
    if (unlockedRods.includes(rod.id)) {
      setEquippedRodId(rod.id);
      return;
    }
    if (gold >= rod.cost) {
      setGold(g => g - rod.cost);
      setUnlockedRods(u => [...u, rod.id]);
      setEquippedRodId(rod.id);
      sounds.playCoin();
    }
  };

  const handleBuyBait = (bait) => {
    if (unlockedBaits.includes(bait.id)) {
      setEquippedBaitId(bait.id);
      return;
    }
    if (gold >= bait.cost) {
      setGold(g => g - bait.cost);
      setUnlockedBaits(u => [...u, bait.id]);
      setEquippedBaitId(bait.id);
      sounds.playCoin();
    }
  };

  const handleBuyShip = (ship) => {
    if (unlockedShips.includes(ship.id)) {
      setEquippedShipId(ship.id);
      return;
    }
    if (gold >= ship.cost) {
      setGold(g => g - ship.cost);
      setUnlockedShips(u => [...u, ship.id]);
      setEquippedShipId(ship.id);
      sounds.playCoin();
    }
  };

  // Hire Crew
  const crewCost = Math.floor(350 * Math.pow(1.6, crewCount));
  const handleHireCrew = () => {
    if (gold >= crewCost) {
      setGold(g => g - crewCost);
      setCrewCount(c => c + 1);
      sounds.playCoin();
    }
  };

  // Prestige Calculations
  const minPrestigeGold = 20000;
  const canPrestige = lifetimeGold >= minPrestigeGold;
  const skullsToClaim = canPrestige ? Math.max(1, Math.floor(Math.sqrt(lifetimeGold / minPrestigeGold))) : 0;

  const performAscension = () => {
    if (!canPrestige) return;

    clearFishingTimers();
    fishStateRef.current = 'idle';
    reelProgressRef.current = 0;
    setFishState('idle');
    setReelProgress(0);
    setCurrentBite(null);
    setRecentCatchAlert(null);

    sounds.playAscend();
    setInfamySkulls(s => s + skullsToClaim);
    setTotalAscensions(a => a + 1);

    setGold(0);
    setLifetimeGold(0);
    setCargo([]);
    setEquippedRodId('rod_1');
    setUnlockedRods(['rod_1']);
    setEquippedBaitId('bait_1');
    setUnlockedBaits(['bait_1']);
    setEquippedShipId('ship_1');
    setUnlockedShips(['ship_1']);
    setCrewCount(0);
    setCurrentZoneId('cove');
    setUnlockedZones(['cove']);

    setShowPrestigeModal(false);
    setActiveTab('cargo');
  };

  const handleBuyPerk = (perk) => {
    const curLevel = perkLevels[perk.id] || 0;
    if (curLevel >= perk.maxLevel) return;

    if (infamySkulls >= perk.costPerLevel) {
      setInfamySkulls(s => s - perk.costPerLevel);
      setPerkLevels(p => ({
        ...p,
        [perk.id]: (p[perk.id] || 0) + 1,
      }));
      sounds.playCoin();
    }
  };

  // Bestiary counts
  const totalSpecies = FISH_DATABASE.length;
  const discoveredSpeciesCount = Object.keys(bestiary).length;
  const completionPercent = Math.round((discoveredSpeciesCount / totalSpecies) * 100);

  const filteredBestiary = useMemo(() => {
    return FISH_DATABASE.filter(f => {
      const isCaught = !!bestiary[f.id];
      if (bestiaryFilter === 'all') return true;
      if (bestiaryFilter === 'caught') return isCaught;
      if (bestiaryFilter === 'undiscovered') return !isCaught;
      return f.zone === bestiaryFilter;
    });
  }, [bestiaryFilter, bestiary]);

  const handleHardReset = () => {
    if (window.confirm('ARE YOU SURE? This will completely wipe all Pirate Fishing progress, Infamy Skulls, and Bestiary!')) {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        // Ignore storage errors
      }
      window.location.reload();
    }
  };

  const passiveFishPerMin = crewCount > 0
    ? (crewCount * 6 * (1 + (perkLevels.perk_crew || 0) * 0.2)).toFixed(1)
    : '0';

  return (
    <div className="game-layout">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <a href="/" className="return-btn" title="Return to Swiss Knife Hub">
            <ArrowLeft size={20} />
          </a>
          <div className="company-branding">
            <div className="company-title">
              <Anchor size={22} className="company-anchor" />
              <span>Blackwater Co.</span>
            </div>
            {totalAscensions > 0 && (
              <span className="infamy-badge">
                <Skull size={13} /> Infamy Rank {totalAscensions} (x{goldMultiplier} Multiplier)
              </span>
            )}
          </div>
        </div>

        <div className="header-right">
          <div className="gold-pill">
            <Coins size={20} color="var(--gold)" />
            <span className="gold-amount">{gold.toLocaleString()}</span>
            <span className="gold-mult-tag">x{goldMultiplier}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('stats');
              fetchPirateLeaderboard();
            }}
            className="icon-tool-btn"
            title="Global Pirate Rankings"
            style={{ color: 'var(--gold)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
          >
            <Trophy size={18} />
          </button>

          <button
            type="button"
            onClick={toggleSound}
            className={`icon-tool-btn ${soundMuted ? 'muted' : ''}`}
            title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* ZONE EXPEDITION BAR */}
      <div className="zone-bar">
        <div className="zone-bar-title">
          <Compass size={16} />
          <span>Ocean Territories:</span>
        </div>
        <div className="zone-pills-scroll">
          {ZONES.map(z => {
            const isUnlocked = unlockedZones.includes(z.id);
            const isActive = currentZoneId === z.id;
            return (
              <button
                type="button"
                key={z.id}
                className={`zone-pill ${isActive ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`}
                onClick={() => handleZoneAction(z)}
              >
                <span className="zone-emoji">{z.ambientEmoji}</span>
                <span className="zone-name">{z.name}</span>
                {!isUnlocked && (
                  <span className="zone-cost">({z.unlockGold.toLocaleString()} G)</span>
                )}
                {isActive && <span className="zone-current-dot">• Active</span>}
              </button>
            );
          })}
        </div>
        {zoneNotice && <span className="zone-toast">{zoneNotice}</span>}
      </div>

      {/* LIVING OCEAN VIEW */}
      <div
        className="ocean-view"
        style={{
          background: currentZone.skyGradient,
        }}
      >
        {currentZoneId === 'cove' && <div className="sun"></div>}
        {currentZoneId === 'reef' && <div className="sun sunset-sun"></div>}
        {currentZoneId === 'graveyard' && <div className="fog-overlay"></div>}
        {currentZoneId === 'abyss' && <div className="abyss-glow"></div>}
        {currentZoneId === 'bermuda' && <div className="void-singularity"></div>}

        <div className="cloud cloud1"></div>
        <div className="cloud cloud2"></div>

        <div
          className="sea"
          style={{
            background: currentZone.seaGradient,
          }}
        >
          <div
            className="wave wave2"
            style={{
              backgroundImage: `radial-gradient(circle at 20px 15px, transparent 20px, ${currentZone.waveColor2} 21px)`,
            }}
          ></div>
          <div
            className="wave"
            style={{
              backgroundImage: `radial-gradient(circle at 20px 15px, transparent 20px, ${currentZone.waveColor} 21px)`,
            }}
          ></div>
        </div>

        {/* Pirate Boat */}
        <div className="boat">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <path d="M10 80 Q 50 102 90 80 L 80 50 L 20 50 Z" fill="var(--wood-dark)" stroke="#000" strokeWidth="2" />
            <rect x="25" y="40" width="22" height="12" fill="#78350f" stroke="#000" strokeWidth="1.5" />
            <line x1="55" y1="50" x2="55" y2="10" stroke="#451a03" strokeWidth="3" />
            <path d="M57 15 Q 75 28 57 44 Z" fill="#f8fafc" stroke="#000" strokeWidth="1.5" />
            <rect x="36" y="8" width="18" height="11" fill="#0f172a" />
            <circle cx="43" cy="13" r="2.5" fill="#f8fafc" />
            <line x1="48" y1="11" x2="52" y2="15" stroke="#f8fafc" strokeWidth="1" />
            <line x1="48" y1="15" x2="52" y2="11" stroke="#f8fafc" strokeWidth="1" />
          </svg>
        </div>

        {/* Dynamic Fishing Action Stage */}
        <div className="fishing-ui">
          {fishState === 'idle' && (
            <div className="idle-control">
              <button
                type="button"
                className="cast-btn"
                onClick={castLine}
                disabled={cargo.length >= currentShip.cargoCap}
              >
                {cargo.length >= currentShip.cargoCap ? 'Cargo Full!' : 'Cast Line 🎣'}
              </button>
              <div className="equipment-quicktag">
                <span>Rod: <strong>{currentRod.name}</strong></span>
                <span>•</span>
                <span>Bait: <strong>{currentBait.name}</strong></span>
              </div>
            </div>
          )}

          {fishState === 'waiting' && (
            <div className="waiting-pill">
              <span className="pulse-dot"></span>
              <span>Luring fish in {currentZone.name}...</span>
            </div>
          )}

          {fishState === 'reeling' && currentBite && (
            <div className="reeling-widget">
              <div className="reeling-header">
                <span className="bite-alert">BITE HOOKED!</span>
                <span
                  className="rarity-pill-inline"
                  style={{
                    color: RARITIES[currentBite.rarity]?.color,
                    borderColor: RARITIES[currentBite.rarity]?.border,
                  }}
                >
                  {currentBite.rarity}
                </span>
              </div>

              <div className="reel-track-wrapper">
                <div className="reel-bar-container">
                  <div
                    className="reel-bar-fill"
                    style={{
                      width: `${reelProgress}%`,
                      background: reelProgress > 70 ? '#22c55e' : reelProgress > 30 ? 'var(--gold)' : '#ef4444',
                    }}
                  ></div>
                </div>

                <div
                  className="reel-fish-sprite"
                  style={{
                    left: `${reelProgress}%`,
                  }}
                >
                  <span className="fish-sprite-emoji">{currentBite.icon}</span>
                </div>
              </div>

              <button type="button" className="reel-action-btn" onClick={reelClick}>
                REEL IN! ⚡
              </button>
            </div>
          )}

          {fishState === 'caught' && recentCatchAlert && (
            <div
              className="caught-modal-banner"
              style={{
                borderColor: RARITIES[recentCatchAlert.fish.rarity]?.color || 'var(--gold)',
              }}
            >
              <div className="caught-eyebrow">
                {recentCatchAlert.isDouble ? "DAVY JONES' BLESSING: DOUBLE CATCH!" : 'SUCCESSFUL CATCH!'}
              </div>
              <div className="caught-fish-row">
                <span className="caught-icon">{recentCatchAlert.fish.icon}</span>
                <div>
                  <h3 className="caught-title">{recentCatchAlert.fish.name}</h3>
                  <span
                    className="caught-rarity"
                    style={{ color: RARITIES[recentCatchAlert.fish.rarity]?.color }}
                  >
                    {recentCatchAlert.fish.rarity} • {recentCatchAlert.fish.weightLbs} lbs
                  </span>
                </div>
              </div>
              <div className="caught-value-badge">
                +{recentCatchAlert.fish.value} Base Gold
              </div>
            </div>
          )}

          {fishState === 'lost' && (
            <div className="lost-banner">
              <span>The fish snapped the line and vanished into the deep...</span>
            </div>
          )}
        </div>
      </div>

      {/* LOWER MANAGEMENT DECK */}
      <div className="management-deck">
        <div className="deck-tabs">
          <button
            type="button"
            className={`deck-tab ${activeTab === 'cargo' ? 'active' : ''}`}
            onClick={() => setActiveTab('cargo')}
          >
            <Fish size={18} />
            <span>Cargo Hold ({cargo.length}/{currentShip.cargoCap})</span>
          </button>

          <button
            type="button"
            className={`deck-tab ${activeTab === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveTab('shop')}
          >
            <ShoppingCart size={18} />
            <span>Black Market & Yard</span>
          </button>

          <button
            type="button"
            className={`deck-tab ${activeTab === 'bestiary' ? 'active' : ''}`}
            onClick={() => setActiveTab('bestiary')}
          >
            <BookOpen size={18} />
            <span>Bestiary ({discoveredSpeciesCount}/{totalSpecies})</span>
          </button>

          <button
            type="button"
            className={`deck-tab ${activeTab === 'ascension' ? 'active' : ''}`}
            onClick={() => setActiveTab('ascension')}
          >
            <Skull size={18} />
            <span>Infamy & Altar</span>
            {canPrestige && <span className="tab-alert-dot">!</span>}
          </button>

          <button
            type="button"
            className={`deck-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Trophy size={18} />
            <span>Captain&apos;s Log</span>
          </button>
        </div>

        <div className="deck-content-pane">
          {/* TAB 1: CARGO HOLD & MARKET */}
          {activeTab === 'cargo' && (
            <div className="cargo-tab-view">
              <div className="cargo-action-strip">
                <div className="cargo-stats-summary">
                  <div>
                    <strong>Hold Capacity:</strong> {cargo.length} / {currentShip.cargoCap}
                  </div>
                  <div>
                    <strong>Sale Multiplier:</strong> <span className="gold-text">x{goldMultiplier}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="sell-all-btn"
                  onClick={sellCargo}
                  disabled={cargo.length === 0}
                >
                  <DollarSign size={20} />
                  <span>
                    Sell All Haul for{' '}
                    <strong>
                      {Math.floor(cargo.reduce((s, f) => s + f.value, 0) * goldMultiplier).toLocaleString()}
                    </strong>{' '}
                    Gold
                  </span>
                </button>
              </div>

              {cargo.length === 0 ? (
                <div className="empty-cargo-notice">
                  <Fish size={48} className="empty-icon" />
                  <p>Your cargo hold is currently empty.</p>
                  <span>Cast your line above or let your automated crew do the fishing!</span>
                </div>
              ) : (
                <div className="cargo-grid">
                  {[...cargo].reverse().map((item, idx) => {
                    const rarityInfo = RARITIES[item.rarity] || RARITIES.Common;
                    return (
                      <div
                        key={`${item.id}-${item.caughtAt || idx}`}
                        className="cargo-card"
                        style={{ borderColor: rarityInfo.border }}
                      >
                        <div className="cargo-card-top">
                          <span className="cargo-emoji">{item.icon}</span>
                          <span
                            className="cargo-rarity-pill"
                            style={{ color: rarityInfo.color, borderColor: rarityInfo.border }}
                          >
                            {item.rarity}
                          </span>
                        </div>
                        <div className="cargo-card-name">{item.name}</div>
                        <div className="cargo-card-details">
                          <span>{item.weightLbs} lbs</span>
                          <span className="cargo-gold-val">+{item.value} G</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHOP, TACKLE & BLACK MARKET */}
          {activeTab === 'shop' && (
            <div className="shop-tab-view">
              <div className="shop-section">
                <h3 className="section-title">
                  <Zap size={20} color="var(--gold)" />
                  Fishing Rods & Winches
                </h3>
                <div className="shop-items-grid">
                  {RODS.map(rod => {
                    const isUnlocked = unlockedRods.includes(rod.id);
                    const isEquipped = equippedRodId === rod.id;
                    const canAfford = gold >= rod.cost;

                    return (
                      <div
                        key={rod.id}
                        className={`item-card ${isEquipped ? 'equipped' : ''}`}
                        style={{ borderColor: rod.color }}
                      >
                        <div className="item-header">
                          <span className="item-badge" style={{ color: rod.color }}>{rod.badge}</span>
                          {isEquipped && <span className="equipped-label">EQUIPPED</span>}
                        </div>
                        <h4 className="item-title">{rod.name}</h4>
                        <p className="item-desc">{rod.desc}</p>
                        <div className="item-specs">
                          <span>Power: +{rod.power}</span>
                          <span>Line Shield: {(rod.drainReduction * 100).toFixed(0)}%</span>
                        </div>
                        <button
                          type="button"
                          className={`item-btn ${isEquipped ? 'equipped-btn' : isUnlocked ? 'equip-btn' : 'buy-btn'}`}
                          disabled={!isUnlocked && !canAfford}
                          onClick={() => handleBuyRod(rod)}
                        >
                          {isEquipped
                            ? 'In Hand'
                            : isUnlocked
                            ? 'Equip Rod'
                            : `Buy for ${rod.cost.toLocaleString()} G`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="shop-section">
                <h3 className="section-title">
                  <Sparkles size={20} color="var(--gold)" />
                  Tackle & Magic Lures
                </h3>
                <div className="shop-items-grid">
                  {BAITS.map(bait => {
                    const isUnlocked = unlockedBaits.includes(bait.id);
                    const isEquipped = equippedBaitId === bait.id;
                    const canAfford = gold >= bait.cost;

                    return (
                      <div
                        key={bait.id}
                        className={`item-card ${isEquipped ? 'equipped' : ''}`}
                        style={{ borderColor: bait.color }}
                      >
                        <div className="item-header">
                          <span className="item-badge" style={{ color: bait.color }}>{bait.badge}</span>
                          {isEquipped && <span className="equipped-label">EQUIPPED</span>}
                        </div>
                        <h4 className="item-title">{bait.name}</h4>
                        <p className="item-desc">{bait.desc}</p>
                        <div className="item-specs">
                          <span>Luck Bonus: +{bait.luckBonus}</span>
                          <span>Rare Boost: +{bait.rareBonus}</span>
                        </div>
                        <button
                          type="button"
                          className={`item-btn ${isEquipped ? 'equipped-btn' : isUnlocked ? 'equip-btn' : 'buy-btn'}`}
                          disabled={!isUnlocked && !canAfford}
                          onClick={() => handleBuyBait(bait)}
                        >
                          {isEquipped
                            ? 'In Use'
                            : isUnlocked
                            ? 'Attach Bait'
                            : `Buy for ${bait.cost.toLocaleString()} G`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="shop-section">
                <h3 className="section-title">
                  <Ship size={20} color="var(--gold)" />
                  Pirate Vessels & Hold Expansions
                </h3>
                <div className="shop-items-grid">
                  {SHIPS.map(ship => {
                    const isUnlocked = unlockedShips.includes(ship.id);
                    const isEquipped = equippedShipId === ship.id;
                    const canAfford = gold >= ship.cost;

                    return (
                      <div
                        key={ship.id}
                        className={`item-card ${isEquipped ? 'equipped' : ''}`}
                      >
                        <div className="item-header">
                          <span className="item-badge">Tier {ship.tier}</span>
                          {isEquipped && <span className="equipped-label">FLAGSHIP</span>}
                        </div>
                        <h4 className="item-title">{ship.name}</h4>
                        <p className="item-desc">{ship.desc}</p>
                        <div className="item-specs">
                          <span>Cargo Hold: {ship.cargoCap} Slots</span>
                          <span>Sale Boost: +{(ship.goldBonus * 100).toFixed(0)}%</span>
                        </div>
                        <button
                          type="button"
                          className={`item-btn ${isEquipped ? 'equipped-btn' : isUnlocked ? 'equip-btn' : 'buy-btn'}`}
                          disabled={!isUnlocked && !canAfford}
                          onClick={() => handleBuyShip(ship)}
                        >
                          {isEquipped
                            ? 'Current Ship'
                            : isUnlocked
                            ? 'Board Ship'
                            : `Buy for ${ship.cost.toLocaleString()} G`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="shop-section">
                <h3 className="section-title">
                  <Anchor size={20} color="var(--gold)" />
                  Pirate Crew Hirelings
                </h3>
                <div className="crew-hire-banner">
                  <div className="crew-hire-info">
                    <h4>Current Crew: {crewCount} Buccaneer Deckhands</h4>
                    <p>
                      Each crew member continuously fishes in your active ocean territory, rolling catches
                      directly into your cargo hold even when you are browsing menus!
                    </p>
                    <span className="crew-rate">
                      Passive Catch Rate: ~{passiveFishPerMin} fish / min
                    </span>
                  </div>
                  <button
                    type="button"
                    className="item-btn buy-btn hire-btn"
                    disabled={gold < crewCost}
                    onClick={handleHireCrew}
                  >
                    Hire Deckhand for {crewCost.toLocaleString()} G
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BESTIARY COMPENDIUM */}
          {activeTab === 'bestiary' && (
            <div className="bestiary-tab-view">
              <div className="bestiary-header-box">
                <div className="bestiary-summary">
                  <h3>Captain&apos;s Marine Bestiary</h3>
                  <p>Discover and catalog all 36 species of the high seas and eldritch depths.</p>
                </div>
                <div className="bestiary-progress-container">
                  <div className="bestiary-progress-label">
                    <span>Compendium Progress:</span>
                    <strong>{discoveredSpeciesCount} / {totalSpecies} ({completionPercent}%)</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${completionPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="bestiary-filter-row">
                <button
                  type="button"
                  className={`filter-btn ${bestiaryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('all')}
                >
                  All ({totalSpecies})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${bestiaryFilter === 'caught' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('caught')}
                >
                  Discovered ({discoveredSpeciesCount})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${bestiaryFilter === 'undiscovered' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('undiscovered')}
                >
                  Undiscovered ({totalSpecies - discoveredSpeciesCount})
                </button>
                {ZONES.map(z => (
                  <button
                    type="button"
                    key={z.id}
                    className={`filter-btn ${bestiaryFilter === z.id ? 'active' : ''}`}
                    onClick={() => setBestiaryFilter(z.id)}
                  >
                    {z.ambientEmoji} {z.name}
                  </button>
                ))}
              </div>

              <div className="bestiary-grid">
                {filteredBestiary.map(fish => {
                  const data = bestiary[fish.id];
                  const isDiscovered = !!data;
                  const rarityInfo = RARITIES[fish.rarity] || RARITIES.Common;
                  const zoneInfo = ZONES.find(z => z.id === fish.zone);

                  return (
                    <div
                      key={fish.id}
                      className={`bestiary-card ${!isDiscovered ? 'unseen' : ''}`}
                      style={{
                        borderColor: isDiscovered ? rarityInfo.border : '#334155',
                      }}
                    >
                      <div className="bestiary-card-header">
                        <span className="bestiary-emoji">
                          {isDiscovered ? fish.icon : '❓'}
                        </span>
                        <span
                          className="bestiary-rarity"
                          style={{
                            color: isDiscovered ? rarityInfo.color : '#64748b',
                            borderColor: isDiscovered ? rarityInfo.border : '#475569',
                          }}
                        >
                          {fish.rarity}
                        </span>
                      </div>

                      <h4 className="bestiary-name">
                        {isDiscovered ? fish.name : 'Unknown Sea Entity'}
                      </h4>

                      <div className="bestiary-location">
                        <Compass size={13} />
                        <span>Habitat: {zoneInfo ? zoneInfo.name : 'Unknown Waters'}</span>
                      </div>

                      {isDiscovered ? (
                        <>
                          <p className="bestiary-lore">{fish.lore}</p>
                          <div className="bestiary-stats-row">
                            <span>Caught: <strong>{data.count}x</strong></span>
                            <span>Record: <strong>{data.maxWeight} lbs</strong></span>
                            <span>Base: <strong>{fish.value} G</strong></span>
                          </div>
                        </>
                      ) : (
                        <div className="bestiary-hidden-hint">
                          <span>Not yet cataloged. Cast line in {zoneInfo ? zoneInfo.name : 'the oceans'} to capture.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: PRESTIGE & INFAMY ASCENSION ALTAR */}
          {activeTab === 'ascension' && (
            <div className="ascension-tab-view">
              <div className="ascension-altar-hero">
                <Skull size={44} className="altar-skull-icon" />
                <h2>Pirate Lord&apos;s Ascension Altar</h2>
                <p>
                  Reset your current gold, gear, and crew to ascend as an infamous Pirate Sovereign.
                  Every ascension grants permanent doubloon multipliers and Infamy Skulls to unlock
                  legendary Captain Talents.
                </p>

                <div className="altar-bank">
                  <div className="altar-bank-stat">
                    <span>Available Infamy Skulls:</span>
                    <strong><Skull size={20} color="var(--gold)" /> {infamySkulls}</strong>
                  </div>
                  <div className="altar-bank-stat">
                    <span>Total Ascensions:</span>
                    <strong>{totalAscensions}</strong>
                  </div>
                  <div className="altar-bank-stat">
                    <span>Active Multiplier:</span>
                    <strong className="gold-text">x{goldMultiplier}</strong>
                  </div>
                </div>

                <div className="ascend-action-box">
                  <div className="ascend-desc">
                    {canPrestige ? (
                      <span className="ready-text">
                        ✨ Ready to Ascend! Resetting now will grant <strong>+{skullsToClaim} Infamy Skull{skullsToClaim > 1 ? 's' : ''}</strong> and an additional <strong>+25% Permanent Gold Multiplier</strong>!
                      </span>
                    ) : (
                      <span className="not-ready-text">
                        🔒 Reach at least <strong>{minPrestigeGold.toLocaleString()} Lifetime Gold</strong> to ascend. Current Run Lifetime Gold: <strong>{lifetimeGold.toLocaleString()} G</strong>.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="ascend-btn"
                    disabled={!canPrestige}
                    onClick={() => setShowPrestigeModal(true)}
                  >
                    <Skull size={22} />
                    <span>Set Sail for New Oceans (Prestige)</span>
                  </button>
                </div>
              </div>

              <div className="perks-section">
                <h3 className="section-title">
                  <Star size={20} color="var(--gold)" />
                  Permanent Captain Talents (Spent with Infamy Skulls)
                </h3>
                <div className="perks-grid">
                  {CAPTAIN_PERKS.map(perk => {
                    const currentLvl = perkLevels[perk.id] || 0;
                    const isMax = currentLvl >= perk.maxLevel;
                    const canAfford = infamySkulls >= perk.costPerLevel;

                    return (
                      <div key={perk.id} className="perk-card">
                        <div className="perk-header">
                          <h4 className="perk-title">{perk.name}</h4>
                          <span className="perk-level">Lvl {currentLvl} / {perk.maxLevel}</span>
                        </div>
                        <p className="perk-desc">{perk.desc}</p>
                        <div className="perk-action-row">
                          <span className="perk-cost">
                            Cost: {isMax ? 'MAX' : `${perk.costPerLevel} Skull${perk.costPerLevel > 1 ? 's' : ''}`}
                          </span>
                          <button
                            type="button"
                            className="perk-buy-btn"
                            disabled={isMax || !canAfford}
                            onClick={() => handleBuyPerk(perk)}
                          >
                            {isMax ? 'Mastered' : 'Upgrade Talent'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STATS & LOGBOOK */}
          {activeTab === 'stats' && (
            <div className="stats-tab-view">
              <h3 className="section-title">
                <Trophy size={20} color="var(--gold)" />
                Captain&apos;s High Seas Logbook
              </h3>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Catches Across All Voyages</span>
                  <span className="stat-val">{totalFishCaught.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Lifetime Gold Earned (All-Time)</span>
                  <span className="stat-val">{allTimeGold.toLocaleString()} G</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Most Valuable Single Fish Landed</span>
                  <span className="stat-val">{highestFishValue.toLocaleString()} G</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Discovered Species in Bestiary</span>
                  <span className="stat-val">{discoveredSpeciesCount} / {totalSpecies}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Infamy Ascensions Performed</span>
                  <span className="stat-val">{totalAscensions}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active Global Multiplier</span>
                  <span className="stat-val gold-text">x{goldMultiplier}</span>
                </div>
              </div>

              {/* GLOBAL LEADERBOARD SECTION */}
              <div style={{ background: '#1e293b', border: '2px solid var(--gold)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trophy size={18} color="var(--gold)" />
                      Global High Seas Sovereign Leaderboard
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {authUser ? (
                        <span>Playing as registered captain: <strong style={{ color: '#fff' }}>{authUser.username}</strong></span>
                      ) : (
                        <span>Playing as guest. <a href="/" style={{ color: '#38bdf8' }}>Sign in</a> on Hub for verified crown!</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="item-btn buy-btn"
                    onClick={submitToGlobalLeaderboard}
                    disabled={submittingLeaderboard || allTimeGold <= 0}
                    style={{ padding: '8px 16px', background: 'var(--gold)', color: '#000', cursor: allTimeGold > 0 ? 'pointer' : 'not-allowed' }}
                  >
                    {submittingLeaderboard ? 'Broadcasting...' : '👑 Broadcast Wealth to Leaderboard'}
                  </button>
                </div>

                {leaderboardNotice && (
                  <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid var(--gold)', color: 'var(--gold)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700' }}>
                    {leaderboardNotice}
                  </div>
                )}

                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {pirateLeaderboard.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No pirate scores recorded yet. Be the first to broadcast your haul!</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid #334155', textAlign: 'left' }}>
                          <th style={{ padding: '8px 6px' }}>Rank</th>
                          <th style={{ padding: '8px 6px' }}>Captain</th>
                          <th style={{ padding: '8px 6px' }}>Lifetime Gold</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right' }}>Infamy Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pirateLeaderboard.map((entry, idx) => {
                          const safeRank = typeof entry.rank === 'number' && Number.isFinite(entry.rank) ? entry.rank : idx + 1;
                          const safeName = String(entry.username || 'Anonymous').slice(0, 24);
                          const safeScore = Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0;
                          const safeInfamy = isFiniteNonNegative(entry.details?.infamy) ? Math.floor(entry.details.infamy) : 0;
                          return (
                            <tr key={entry.id || idx} style={{ borderBottom: '1px solid #0f172a', background: authUser && authUser.username === safeName ? 'rgba(245,158,11,0.1)' : 'transparent' }}>
                              <td style={{ padding: '8px 6px', fontWeight: '900', color: safeRank === 1 ? 'var(--gold)' : '#fff' }}>#{safeRank}</td>
                              <td style={{ padding: '8px 6px' }}>
                                <strong>{safeName}</strong>
                                {entry.isVerified && <span style={{ color: '#22c55e', marginLeft: '4px', fontWeight: '900' }}>✓</span>}
                              </td>
                              <td style={{ padding: '8px 6px', color: 'var(--gold)', fontWeight: '900' }}>{safeScore.toLocaleString()} G</td>
                              <td style={{ padding: '8px 6px', textAlign: 'right', color: '#cbd5e1' }}>{`Rank ${safeInfamy}`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="reset-save-strip">
                <p>Want to completely wipe local save data and begin from scratch?</p>
                <button type="button" className="hard-reset-btn" onClick={handleHardReset}>
                  Reset All Game Save Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION PRESTIGE MODAL */}
      {showPrestigeModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <Skull size={48} color="var(--gold)" />
            <h2>ASCEND AS PIRATE SOVEREIGN?</h2>
            <p>
              Setting sail for new oceans will reset your current gold, cargo, rods, bait, fleet, and crew.
            </p>
            <div className="modal-rewards">
              <div>🎁 You will gain: <strong>+{skullsToClaim} Infamy Skull{skullsToClaim > 1 ? 's' : ''}</strong></div>
              <div>⚡ Permanent Multiplier increases by <strong>+25%</strong></div>
              <div>📖 Your Bestiary Discoveries & Captain Perks will <strong>remain permanently</strong>!</div>
            </div>
            <div className="modal-buttons">
              <button type="button" className="confirm-ascend-btn" onClick={performAscension}>
                Yes, Ascend as Pirate Lord!
              </button>
              <button type="button" className="cancel-modal-btn" onClick={() => setShowPrestigeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
