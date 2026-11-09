import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  RefreshCw,
  Trophy,
  ArrowLeft,
  Star,
  Check,
  Zap,
  Info,
  Waves
} from 'lucide-react';
import { ZONES, RARITIES, FISH_DATABASE } from './data/fishDatabase';
import { RODS, BAITS, SHIPS, CAPTAIN_PERKS } from './data/equipment';
import { sounds } from './utils/soundEffects';
import './index.css';

const SAVE_KEY = 'pirate_fishing_save_v3';

function App() {
  // Load initial persistent state
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [gold, setGold] = useState(0);
  const [lifetimeGold, setLifetimeGold] = useState(0);
  const [allTimeGold, setAllTimeGold] = useState(0);
  const [totalFishCaught, setTotalFishCaught] = useState(0);
  const [highestFishValue, setHighestFishValue] = useState(0);

  const [cargo, setCargo] = useState([]);
  const [equippedRodId, setEquippedRodId] = useState('rod_1');
  const [unlockedRods, setUnlockedRods] = useState(['rod_1']);
  const [equippedBaitId, setEquippedBaitId] = useState('bait_1');
  const [unlockedBaits, setUnlockedBaits] = useState(['bait_1']);
  const [equippedShipId, setEquippedShipId] = useState('ship_1');
  const [unlockedShips, setUnlockedShips] = useState(['ship_1']);

  const [crewCount, setCrewCount] = useState(0);
  const [currentZoneId, setCurrentZoneId] = useState('cove');
  const [unlockedZones, setUnlockedZones] = useState(['cove']);

  // Prestige / Infamy Ascension System
  const [infamySkulls, setInfamySkulls] = useState(0);
  const [totalAscensions, setTotalAscensions] = useState(0);
  const [perkLevels, setPerkLevels] = useState({
    perk_greed: 0,
    perk_power: 0,
    perk_crew: 0,
    perk_double: 0,
  });

  // Compendium Bestiary: { [fishId]: { count, maxWeight, firstCaught } }
  const [bestiary, setBestiary] = useState({});

  // Active UI Tab: 'cargo' | 'shop' | 'bestiary' | 'ascension' | 'stats'
  const [activeTab, setActiveTab] = useState('cargo');
  const [bestiaryFilter, setBestiaryFilter] = useState('all'); // 'all' | 'caught' | 'undiscovered' | zoneId
  const [soundMuted, setSoundMuted] = useState(false);
  const [showPrestigeModal, setShowPrestigeModal] = useState(false);
  const [recentCatchAlert, setRecentCatchAlert] = useState(null);

  // Fishing Minigame State: 'idle' | 'waiting' | 'reeling' | 'caught' | 'lost'
  const [fishState, setFishState] = useState('idle');
  const [reelProgress, setReelProgress] = useState(0);
  const [currentBite, setCurrentBite] = useState(null);
  const [doubleCatchTriggered, setDoubleCatchTriggered] = useState(false);

  const reelTimerRef = useRef(null);

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.gold === 'number') setGold(data.gold);
        if (typeof data.lifetimeGold === 'number') setLifetimeGold(data.lifetimeGold);
        if (typeof data.allTimeGold === 'number') setAllTimeGold(data.allTimeGold);
        if (typeof data.totalFishCaught === 'number') setTotalFishCaught(data.totalFishCaught);
        if (typeof data.highestFishValue === 'number') setHighestFishValue(data.highestFishValue);
        if (Array.isArray(data.cargo)) setCargo(data.cargo);
        if (data.equippedRodId) setEquippedRodId(data.equippedRodId);
        if (Array.isArray(data.unlockedRods)) setUnlockedRods(data.unlockedRods);
        if (data.equippedBaitId) setEquippedBaitId(data.equippedBaitId);
        if (Array.isArray(data.unlockedBaits)) setUnlockedBaits(data.unlockedBaits);
        if (data.equippedShipId) setEquippedShipId(data.equippedShipId);
        if (Array.isArray(data.unlockedShips)) setUnlockedShips(data.unlockedShips);
        if (typeof data.crewCount === 'number') setCrewCount(data.crewCount);
        if (data.currentZoneId) setCurrentZoneId(data.currentZoneId);
        if (Array.isArray(data.unlockedZones)) setUnlockedZones(data.unlockedZones);
        if (typeof data.infamySkulls === 'number') setInfamySkulls(data.infamySkulls);
        if (typeof data.totalAscensions === 'number') setTotalAscensions(data.totalAscensions);
        if (data.perkLevels) setPerkLevels(data.perkLevels);
        if (data.bestiary) setBestiary(data.bestiary);
        if (typeof data.soundMuted === 'boolean') {
          setSoundMuted(data.soundMuted);
          sounds.muted = data.soundMuted;
        }
      }
    } catch (e) {
      console.warn('Could not load pirate fishing save:', e);
    }
    setSaveLoaded(true);
  }, []);

  // 2. Auto-save to LocalStorage
  useEffect(() => {
    if (!saveLoaded) return;
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
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }, [
    saveLoaded,
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

  // Derived Equipment Objects
  const currentRod = useMemo(() => RODS.find(r => r.id === equippedRodId) || RODS[0], [equippedRodId]);
  const currentBait = useMemo(() => BAITS.find(b => b.id === equippedBaitId) || BAITS[0], [equippedBaitId]);
  const currentShip = useMemo(() => SHIPS.find(s => s.id === equippedShipId) || SHIPS[0], [equippedShipId]);
  const currentZone = useMemo(() => ZONES.find(z => z.id === currentZoneId) || ZONES[0], [currentZoneId]);

  // Total Gold Multiplier Calculation
  // Base 1.0 + (Total Ascensions * 0.25) + Greed Perk + Ship Bonus
  const goldMultiplier = useMemo(() => {
    const infamyBonus = totalAscensions * 0.25;
    const greedBonus = (perkLevels.perk_greed || 0) * 0.15;
    const shipBonus = currentShip.goldBonus || 0;
    return Number((1 + infamyBonus + greedBonus + shipBonus).toFixed(2));
  }, [totalAscensions, perkLevels.perk_greed, currentShip.goldBonus]);

  // Toggle Sound
  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    sounds.muted = next;
  };

  // Roll a Random Fish based on Zone and Bait Luck
  const rollFish = () => {
    // Candidates for current zone (plus small chance for wanderers in Bermuda)
    const available = FISH_DATABASE.filter(f => f.zone === currentZoneId || (currentZoneId === 'bermuda' && f.rarity === 'Mythic'));
    if (available.length === 0) return FISH_DATABASE[0];

    const luck = currentBait.luckBonus || 0;
    const rareLuck = currentBait.rareBonus || 0;

    let weightedList = available.map(f => {
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

    for (let item of weightedList) {
      if (rand < item.weight) {
        // Generate random realistic weight in lbs based on baseValue
        const baseLbs = (item.fish.value * 0.08) + 1.2;
        const actualWeight = Number((baseLbs * (0.8 + Math.random() * 0.5)).toFixed(1));
        return { ...item.fish, weightLbs: actualWeight, caughtAt: Date.now() };
      }
      rand -= item.weight;
    }
    return { ...available[0], weightLbs: 2.5, caughtAt: Date.now() };
  };

  // Cast Line
  const castLine = () => {
    if (fishState !== 'idle') return;
    if (cargo.length >= currentShip.cargoCap) {
      alert(`Cargo Hold is full (${cargo.length}/${currentShip.cargoCap})! Visit Cargo Hold to sell your haul first.`);
      return;
    }

    sounds.playCast();
    setFishState('waiting');
    setDoubleCatchTriggered(false);

    // Random wait between 1.5s and 3.8s
    const waitTime = 1500 + Math.random() * 2300;
    setTimeout(() => {
      const rolled = rollFish();
      setCurrentBite(rolled);
      setFishState('reeling');
      setReelProgress(35); // Start at 35%
      sounds.playBite();
    }, waitTime);
  };

  // Reeling Drain Loop
  useEffect(() => {
    if (fishState === 'reeling') {
      reelTimerRef.current = setInterval(() => {
        setReelProgress(p => {
          const drainReduction = currentRod.drainReduction || 0;
          const diff = currentBite?.difficulty || 1.0;
          const drainRate = (2.2 * diff) * (1 - drainReduction);

          const newP = p - drainRate;
          if (newP <= 0) {
            setFishState('lost');
            setTimeout(() => setFishState('idle'), 1400);
            return 0;
          }
          return newP;
        });
      }, 100);
    } else {
      clearInterval(reelTimerRef.current);
    }
    return () => clearInterval(reelTimerRef.current);
  }, [fishState, currentBite, currentRod]);

  // Reel Click Handler
  const reelClick = () => {
    if (fishState !== 'reeling' || !currentBite) return;

    sounds.playReelClick();

    setReelProgress(p => {
      const rodPower = currentRod.power + ((perkLevels.perk_power || 0) * 10);
      const newP = p + rodPower;

      if (newP >= 100) {
        // CAUGHT!
        handleCatchSuccess(currentBite);
        return 100;
      }
      return newP;
    });
  };

  // Handle successful fish catch
  const handleCatchSuccess = (caughtFish) => {
    setFishState('caught');
    sounds.playCatch(caughtFish.rarity);

    // Check Davy Jones double catch perk
    const doublePerkChance = (perkLevels.perk_double || 0) * 0.06;
    const isDouble = Math.random() < doublePerkChance;
    setDoubleCatchTriggered(isDouble);

    const fishToAdd = isDouble ? [caughtFish, { ...caughtFish, caughtAt: Date.now() + 1 }] : [caughtFish];

    setCargo(c => {
      const remainingSlots = Math.max(0, currentShip.cargoCap - c.length);
      return [...c, ...fishToAdd.slice(0, remainingSlots)];
    });

    setTotalFishCaught(prev => prev + (isDouble ? 2 : 1));
    setHighestFishValue(prev => Math.max(prev, caughtFish.value));

    // Update Bestiary
    setBestiary(prev => {
      const existing = prev[caughtFish.id] || { count: 0, maxWeight: 0, firstCaught: Date.now() };
      return {
        ...prev,
        [caughtFish.id]: {
          count: existing.count + (isDouble ? 2 : 1),
          maxWeight: Math.max(existing.maxWeight, caughtFish.weightLbs),
          firstCaught: existing.firstCaught || Date.now(),
        }
      };
    });

    setRecentCatchAlert({
      fish: caughtFish,
      isDouble,
    });

    setTimeout(() => {
      setFishState('idle');
      setRecentCatchAlert(null);
    }, 1800);
  };

  // Passive Crew Auto-Fishing
  useEffect(() => {
    if (crewCount <= 0) return;

    // Crew speed calculation boosted by crew perk
    const intervalTime = Math.max(2500, Math.floor(10000 / (1 + (perkLevels.perk_crew || 0) * 0.2)));

    const interval = setInterval(() => {
      setCargo(prevCargo => {
        if (prevCargo.length >= currentShip.cargoCap) return prevCargo;

        const autoFish = rollFish();
        // Update bestiary silently
        setBestiary(b => {
          const ex = b[autoFish.id] || { count: 0, maxWeight: 0, firstCaught: Date.now() };
          return {
            ...b,
            [autoFish.id]: {
              count: ex.count + 1,
              maxWeight: Math.max(ex.maxWeight, autoFish.weightLbs),
              firstCaught: ex.firstCaught || Date.now(),
            }
          };
        });

        setTotalFishCaught(t => t + 1);
        setHighestFishValue(h => Math.max(h, autoFish.value));

        return [...prevCargo, autoFish];
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [crewCount, currentZoneId, equippedBaitId, perkLevels.perk_crew, currentShip.cargoCap]);

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
      return;
    }

    if (gold >= zone.unlockGold) {
      setGold(g => g - zone.unlockGold);
      setUnlockedZones(u => [...u, zone.id]);
      setCurrentZoneId(zone.id);
      sounds.playCoin();
    } else {
      alert(`Need ${zone.unlockGold.toLocaleString()} Gold to charter an expedition to ${zone.name}!`);
    }
  };

  // Buy & Equip Rod
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

  // Buy & Equip Bait
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

  // Buy & Equip Ship
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
  // Lifetime gold >= 20,000 required for ascension
  const minPrestigeGold = 20000;
  const canPrestige = lifetimeGold >= minPrestigeGold;
  const skullsToClaim = canPrestige ? Math.max(1, Math.floor(Math.sqrt(lifetimeGold / minPrestigeGold))) : 0;

  const performAscension = () => {
    if (!canPrestige) return;

    sounds.playAscend();
    setInfamySkulls(s => s + skullsToClaim);
    setTotalAscensions(a => a + 1);

    // Reset current run
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

  // Buy Captain Perk
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

  // Filtered Bestiary List
  const filteredBestiary = useMemo(() => {
    return FISH_DATABASE.filter(f => {
      const isCaught = !!bestiary[f.id];
      if (bestiaryFilter === 'all') return true;
      if (bestiaryFilter === 'caught') return isCaught;
      if (bestiaryFilter === 'undiscovered') return !isCaught;
      return f.zone === bestiaryFilter;
    });
  }, [bestiaryFilter, bestiary]);

  // Reset entire game data
  const handleHardReset = () => {
    if (window.confirm("ARE YOU SURE? This will completely wipe all Pirate Fishing progress, Infamy Skulls, and Bestiary!")) {
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    }
  };

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
      </div>

      {/* LIVING OCEAN VIEW */}
      <div
        className="ocean-view"
        style={{
          background: currentZone.skyGradient,
        }}
      >
        {/* Dynamic Sky & Weather */}
        {currentZoneId === 'cove' && <div className="sun"></div>}
        {currentZoneId === 'reef' && <div className="sun sunset-sun"></div>}
        {currentZoneId === 'graveyard' && <div className="fog-overlay"></div>}
        {currentZoneId === 'abyss' && <div className="abyss-glow"></div>}
        {currentZoneId === 'bermuda' && <div className="void-singularity"></div>}

        <div className="cloud cloud1"></div>
        <div className="cloud cloud2"></div>

        {/* Sea Waves with Dynamic Zone Colors */}
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
            {/* Hull */}
            <path d="M10 80 Q 50 102 90 80 L 80 50 L 20 50 Z" fill="var(--wood-dark)" stroke="#000" strokeWidth="2" />
            {/* Cabin */}
            <rect x="25" y="40" width="22" height="12" fill="#78350f" stroke="#000" strokeWidth="1.5" />
            {/* Mast */}
            <line x1="55" y1="50" x2="55" y2="10" stroke="#451a03" strokeWidth="3" />
            {/* Main Sail */}
            <path d="M57 15 Q 75 28 57 44 Z" fill="#f8fafc" stroke="#000" strokeWidth="1.5" />
            {/* Pirate Jolly Roger Flag */}
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

              {/* Reel Progress Track */}
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

                {/* Animated Fish Icon along track */}
                <div
                  className="reel-fish-sprite"
                  style={{
                    left: `${reelProgress}%`,
                  }}
                >
                  <span className="fish-sprite-emoji">{currentBite.icon}</span>
                </div>
              </div>

              <button className="reel-action-btn" onClick={reelClick}>
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
        {/* Navigation Tabs */}
        <div className="deck-tabs">
          <button
            className={`deck-tab ${activeTab === 'cargo' ? 'active' : ''}`}
            onClick={() => setActiveTab('cargo')}
          >
            <Fish size={18} />
            <span>Cargo Hold ({cargo.length}/{currentShip.cargoCap})</span>
          </button>

          <button
            className={`deck-tab ${activeTab === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveTab('shop')}
          >
            <ShoppingCart size={18} />
            <span>Black Market & Yard</span>
          </button>

          <button
            className={`deck-tab ${activeTab === 'bestiary' ? 'active' : ''}`}
            onClick={() => setActiveTab('bestiary')}
          >
            <BookOpen size={18} />
            <span>Bestiary ({discoveredSpeciesCount}/{totalSpecies})</span>
          </button>

          <button
            className={`deck-tab ${activeTab === 'ascension' ? 'active' : ''}`}
            onClick={() => setActiveTab('ascension')}
          >
            <Skull size={18} />
            <span>Infamy & Altar</span>
            {canPrestige && <span className="tab-alert-dot">!</span>}
          </button>

          <button
            className={`deck-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <Trophy size={18} />
            <span>Captain's Log</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
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
                        key={idx}
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
              {/* SECTION: FISHING RODS */}
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

              {/* SECTION: BAITS */}
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

              {/* SECTION: PIRATE SHIPS & FLEET */}
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

              {/* SECTION: CREW AUTOMATION */}
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
                      Passive Catch Rate: ~{crewCount > 0 ? (60 / (10 / (1 + (perkLevels.perk_crew || 0) * 0.2))).toFixed(1) : 0} fish / min
                    </span>
                  </div>
                  <button
                    className="buy-btn hire-btn"
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
                  <h3>Captain's Marine Bestiary</h3>
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

              {/* Bestiary Filters */}
              <div className="bestiary-filter-row">
                <button
                  className={`filter-btn ${bestiaryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('all')}
                >
                  All ({totalSpecies})
                </button>
                <button
                  className={`filter-btn ${bestiaryFilter === 'caught' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('caught')}
                >
                  Discovered ({discoveredSpeciesCount})
                </button>
                <button
                  className={`filter-btn ${bestiaryFilter === 'undiscovered' ? 'active' : ''}`}
                  onClick={() => setBestiaryFilter('undiscovered')}
                >
                  Undiscovered ({totalSpecies - discoveredSpeciesCount})
                </button>
                {ZONES.map(z => (
                  <button
                    key={z.id}
                    className={`filter-btn ${bestiaryFilter === z.id ? 'active' : ''}`}
                    onClick={() => setBestiaryFilter(z.id)}
                  >
                    {z.ambientEmoji} {z.name}
                  </button>
                ))}
              </div>

              {/* Fish Cards Grid */}
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
                <h2>Pirate Lord's Ascension Altar</h2>
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
                    className="ascend-btn"
                    disabled={!canPrestige}
                    onClick={() => setShowPrestigeModal(true)}
                  >
                    <Skull size={22} />
                    <span>Set Sail for New Oceans (Prestige)</span>
                  </button>
                </div>
              </div>

              {/* CAPTAIN PERKS TREE */}
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
                Captain's High Seas Logbook
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

              <div className="reset-save-strip">
                <p>Want to completely wipe local save data and begin from scratch?</p>
                <button className="hard-reset-btn" onClick={handleHardReset}>
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
              <button className="confirm-ascend-btn" onClick={performAscension}>
                Yes, Ascend as Pirate Lord!
              </button>
              <button className="cancel-modal-btn" onClick={() => setShowPrestigeModal(false)}>
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
