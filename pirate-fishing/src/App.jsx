import React, { useState, useEffect, useRef } from 'react';
import { Coins, Anchor, Fish, Ship, ShoppingCart, DollarSign } from 'lucide-react';
import './index.css';

const FISH_DB = [
  { id: 'anchovy', name: 'Anchovy', value: 5, weight: 100 },
  { id: 'cod', name: 'Cod', value: 20, weight: 40 },
  { id: 'swordfish', name: 'Swordfish', value: 100, weight: 10 },
  { id: 'leviathan', name: 'Golden Leviathan', value: 1000, weight: 2 },
  { id: 'kraken', name: 'Kraken Tentacle', value: 5000, weight: 0.5 },
];

const UPGRADES = [
  { id: 'rod', name: 'Sturdy Rod', desc: 'Increases reel power.', baseCost: 50, costMult: 1.5 },
  { id: 'bait', name: 'Premium Bait', desc: 'Increases rare fish chance.', baseCost: 150, costMult: 1.8 },
  { id: 'crew', name: 'Hire Pirate Crew', desc: 'Auto-catches 1 fish every 10s.', baseCost: 500, costMult: 2.0 },
];

function App() {
  const [gold, setGold] = useState(0);
  const [cargo, setCargo] = useState([]);
  
  const [upgrades, setUpgrades] = useState({
    rod: 0,
    bait: 0,
    crew: 0
  });

  // Fishing Minigame State
  // 'idle' | 'waiting' | 'reeling' | 'caught' | 'lost'
  const [fishState, setFishState] = useState('idle');
  const [reelProgress, setReelProgress] = useState(0);
  const [currentBite, setCurrentBite] = useState(null);
  
  const reelTimerRef = useRef(null);

  const getCost = (upgradeId) => {
    const upg = UPGRADES.find(u => u.id === upgradeId);
    return Math.floor(upg.baseCost * Math.pow(upg.costMult, upgrades[upgradeId]));
  };

  const buyUpgrade = (id) => {
    const cost = getCost(id);
    if (gold >= cost) {
      setGold(g => g - cost);
      setUpgrades(u => ({ ...u, [id]: u[id] + 1 }));
    }
  };

  const sellCargo = () => {
    const total = cargo.reduce((sum, f) => sum + f.value, 0);
    if (total > 0) {
      setGold(g => g + total);
      setCargo([]);
    }
  };

  const getRandomFish = () => {
    // Bait increases the weight of rare fish implicitly by adding a bonus
    const luckBonus = upgrades.bait * 10; 
    let totalWeight = FISH_DB.reduce((sum, f) => sum + f.weight + (f.value > 50 ? luckBonus : 0), 0);
    
    let rand = Math.random() * totalWeight;
    for (let f of FISH_DB) {
      const w = f.weight + (f.value > 50 ? luckBonus : 0);
      if (rand < w) return f;
      rand -= w;
    }
    return FISH_DB[0];
  };

  const castLine = () => {
    if (fishState !== 'idle') return;
    setFishState('waiting');
    
    // Wait between 2 and 5 seconds for a bite
    const waitTime = 2000 + Math.random() * 3000;
    setTimeout(() => {
      setFishState('reeling');
      setReelProgress(30); // Start at 30%
      setCurrentBite(getRandomFish());
    }, waitTime);
  };

  // Reeling mechanic
  useEffect(() => {
    if (fishState === 'reeling') {
      reelTimerRef.current = setInterval(() => {
        setReelProgress(p => {
          const drainRate = 2 + (currentBite?.value > 50 ? 2 : 0); // Harder fish drain faster
          const newP = p - drainRate;
          if (newP <= 0) {
            setFishState('lost');
            setTimeout(() => setFishState('idle'), 1500);
            return 0;
          }
          return newP;
        });
      }, 100);
    } else {
      clearInterval(reelTimerRef.current);
    }
    return () => clearInterval(reelTimerRef.current);
  }, [fishState, currentBite]);

  const reelClick = () => {
    if (fishState === 'reeling') {
      setReelProgress(p => {
        const power = 5 + (upgrades.rod * 2);
        const newP = p + power;
        if (newP >= 100) {
          setFishState('caught');
          setCargo(c => [...c, currentBite]);
          setTimeout(() => setFishState('idle'), 1500);
          return 100;
        }
        return newP;
      });
    }
  };

  // Passive Crew Income
  useEffect(() => {
    if (upgrades.crew > 0) {
      const interval = setInterval(() => {
        // Each crew member rolls a fish every 10 seconds
        for(let i=0; i < upgrades.crew; i++) {
          setCargo(c => [...c, getRandomFish()]);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [upgrades.crew, upgrades.bait]);

  return (
    <div className="game-layout">
      {/* Header */}
      <header className="header">
        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
          <a href="/" className="return-btn" title="Return to Hub">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </a>
          <div className="company-name"><Anchor size={28} style={{display:'inline', verticalAlign:'middle', marginRight:'10px', color: 'var(--gold)'}}/> Blackwater Co.</div>
        </div>
        <div className="gold-display">
          <Coins color="var(--gold)" />
          {gold.toLocaleString()}
        </div>
      </header>

      {/* Main Ocean Area */}
      <div className="ocean-view">
        
        {/* Sky Elements */}
        <div className="sun"></div>
        <div className="cloud cloud1"></div>
        <div className="cloud cloud2"></div>

        {/* Sea Elements */}
        <div className="sea">
          <div className="wave wave2"></div>
          <div className="wave"></div>
        </div>

        <div className="boat">
          {/* Simple SVG Pirate Boat */}
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <path d="M10 80 Q 50 100 90 80 L 80 50 L 20 50 Z" fill="var(--wood-dark)" />
            <path d="M45 50 L 45 10 L 80 40 L 45 40" fill="white" />
            {/* Pirate Flag */}
            <rect x="45" y="10" width="15" height="10" fill="black" />
          </svg>
        </div>

        <div className="fishing-ui">
          {fishState === 'idle' && <button className="cast-btn" onClick={castLine}>Cast Line</button>}
          {fishState === 'waiting' && <h2 style={{color: 'white', textShadow: '0 2px 5px black', animation: 'floatBoat 2s infinite'}}>...Waiting for bite...</h2>}
          
          {fishState === 'reeling' && (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'15px'}}>
              <h2 style={{color: 'red', textShadow: '0 2px 5px black'}}>BITE! CLICK TO REEL!</h2>
              
              <div style={{position: 'relative', width: '300px', height: '40px'}}>
                <div className="reel-bar-container" style={{position:'absolute', width:'100%', bottom: 0}}>
                  <div className="reel-bar-fill" style={{width: `${reelProgress}%`}}></div>
                </div>
                {/* Visual Fish Pulling */}
                <div style={{
                  position: 'absolute', 
                  bottom: '35px', 
                  left: `${reelProgress}%`, 
                  transform: 'translateX(-50%)',
                  transition: 'left 0.1s linear',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  <Fish size={32} color={currentBite.value > 50 ? 'var(--gold)' : 'white'} />
                </div>
              </div>

              <button className="cast-btn" onClick={reelClick}>REEL!</button>
            </div>
          )}

          {fishState === 'caught' && (
            <div style={{textAlign: 'center', background:'rgba(0,0,0,0.7)', padding:'20px', borderRadius:'15px', border: '2px solid var(--gold)', animation: 'pulseSun 0.5s ease'}}>
              <h2 style={{color: 'var(--gold)', marginBottom:'10px'}}>CAUGHT!</h2>
              <p style={{fontSize:'1.5rem'}}>{currentBite.name}</p>
              <p style={{color:'var(--gold)'}}>+{currentBite.value} Value</p>
            </div>
          )}

          {fishState === 'lost' && (
            <div style={{textAlign: 'center', background:'rgba(0,0,0,0.7)', padding:'20px', borderRadius:'15px'}}>
              <h2 style={{color: 'gray'}}>Got away...</h2>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Management Panels */}
      <div className="bottom-panels">
        
        {/* Cargo */}
        <div className="panel">
          <h2><Fish /> Cargo Hold ({cargo.length})</h2>
          <div className="cargo-list">
            {cargo.length === 0 && <p style={{color:'var(--text-muted)'}}>Cargo is empty. Go fish!</p>}
            {[...cargo].reverse().map((f, i) => (
              <div key={i} className="cargo-item">
                <span className="fish-name">{f.name}</span>
                <span className="fish-value">{f.value} <DollarSign size={14} style={{display:'inline', verticalAlign:'middle'}}/></span>
              </div>
            ))}
          </div>
          <button className="sell-btn" onClick={sellCargo} disabled={cargo.length === 0}>
            Sell All for {cargo.reduce((sum, f) => sum + f.value, 0)} Gold
          </button>
        </div>

        {/* Upgrades */}
        <div className="panel">
          <h2><ShoppingCart /> Black Market</h2>
          <div className="upgrade-list">
            {UPGRADES.map(u => {
              const cost = getCost(u.id);
              const canAfford = gold >= cost;
              return (
                <div key={u.id} className="upgrade-card">
                  <div className="upgrade-info">
                    <h3>{u.name} (Lvl {upgrades[u.id]})</h3>
                    <p>{u.desc}</p>
                  </div>
                  <button 
                    className="buy-btn" 
                    disabled={!canAfford}
                    onClick={() => buyUpgrade(u.id)}
                  >
                    {cost} G
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Crew Status (Optional 3rd Panel) */}
        <div className="panel">
          <h2><Ship /> Company Status</h2>
          <div style={{color:'var(--text-muted)', lineHeight:'1.8'}}>
            <p><strong>Fleet Power:</strong> Level {upgrades.rod}</p>
            <p><strong>Luck Bonus:</strong> +{upgrades.bait * 10}%</p>
            <p><strong>Crew Size:</strong> {upgrades.crew} Pirates</p>
            <p><strong>Passive Income Rate:</strong> ~{upgrades.crew * 6} fish / min</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
