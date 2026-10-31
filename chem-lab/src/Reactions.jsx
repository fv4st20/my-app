import React, { useState } from 'react';

const Reactions = () => {
  const [reactantA, setReactantA] = useState('');
  const [reactantB, setReactantB] = useState('');
  const [reactionResult, setReactionResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const chemicals = [
    { id: 'water', name: 'Water (H₂O)', color: '#3b82f6', icon: '💧' },
    { id: 'sodium', name: 'Sodium (Na)', color: '#94a3b8', icon: '🧊' },
    { id: 'hcl', name: 'Hydrochloric Acid (HCl)', color: '#ef4444', icon: '🧪' },
    { id: 'naoh', name: 'Sodium Hydroxide (NaOH)', color: '#a855f7', icon: '🧪' },
    { id: 'coke', name: 'Diet Coke', color: '#451a03', icon: '🥤' },
    { id: 'mentos', name: 'Mentos', color: '#e2e8f0', icon: '🍬' },
    { id: 'bleach', name: 'Bleach (NaClO)', color: '#fcd34d', icon: '🧴' },
    { id: 'ammonia', name: 'Ammonia (NH₃)', color: '#6ee7b7', icon: '🧴' },
  ];

  const handleMix = () => {
    if (!reactantA || !reactantB) return;
    
    setIsAnimating(true);
    setReactionResult(null);

    setTimeout(() => {
      setIsAnimating(false);
      determineReaction(reactantA, reactantB);
    }, 1500); // 1.5s animation
  };

  const determineReaction = (a, b) => {
    const pair = [a, b].sort().join('+');
    let result = {};

    switch(pair) {
      case 'sodium+water':
        result = { title: "Explosive Reaction!", desc: "Sodium violently reacts with water to form sodium hydroxide and hydrogen gas, which ignites from the heat.", type: "explosion", eq: "2Na + 2H₂O → 2NaOH + H₂" };
        break;
      case 'hcl+naoh':
        result = { title: "Neutralization", desc: "A strong acid and a strong base react to form saltwater and heat.", type: "neutralization", eq: "HCl + NaOH → NaCl + H₂O" };
        break;
      case 'coke+mentos':
        result = { title: "Nucleation Geyser", desc: "The porous surface of Mentos causes rapid nucleation of carbon dioxide gas in the soda, creating a massive geyser.", type: "geyser", eq: "Physical Reaction (CO₂ rapid release)" };
        break;
      case 'ammonia+bleach':
        result = { title: "Toxic Gas!", desc: "WARNING! Mixing bleach and ammonia creates highly toxic chloramine gas. Never do this in real life!", type: "toxic", eq: "NH₃ + NaOCl → NH₂Cl + NaOH" };
        break;
      case 'water+water':
        result = { title: "More Water", desc: "You mixed water with water. You now have more water.", type: "neutral", eq: "H₂O + H₂O → 2H₂O" };
        break;
      case 'hcl+water':
      case 'naoh+water':
        result = { title: "Dilution", desc: "You diluted the chemical with water. It releases some heat.", type: "neutral", eq: "Dilution" };
        break;
      default:
        result = { title: "No Reaction", desc: "These two chemicals don't do anything interesting when mixed at room temperature.", type: "neutral", eq: "N/A" };
    }
    
    setReactionResult(result);
  };

  return (
    <div className="reactions-container">
      <header className="header">
        <h1>Interactive Lab Bench</h1>
        <p>Mix chemicals to see what happens. Warning: Some reactions are dangerous!</p>
      </header>

      <div className="lab-bench glass-panel">
        <div className="selectors">
          <div className="selector">
            <h3>Reactant A</h3>
            <select value={reactantA} onChange={(e) => setReactantA(e.target.value)}>
              <option value="">-- Select Chemical --</option>
              {chemicals.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          <div className="mix-control">
            <button className="mix-btn" onClick={handleMix} disabled={!reactantA || !reactantB || isAnimating}>
              {isAnimating ? 'MIXING...' : 'MIX CHEMICALS'}
            </button>
          </div>

          <div className="selector">
            <h3>Reactant B</h3>
            <select value={reactantB} onChange={(e) => setReactantB(e.target.value)}>
              <option value="">-- Select Chemical --</option>
              {chemicals.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="reaction-stage">
          {isAnimating && (
            <div className="animating-flask">
              <div className="liquid shaking"></div>
            </div>
          )}

          {reactionResult && !isAnimating && (
            <div className={`reaction-result type-${reactionResult.type}`}>
              <h2>{reactionResult.title}</h2>
              <div className="equation-display">{reactionResult.eq}</div>
              <p>{reactionResult.desc}</p>
              {reactionResult.type === 'explosion' && <div className="effect explosion-effect">💥🔥</div>}
              {reactionResult.type === 'geyser' && <div className="effect geyser-effect">⛲</div>}
              {reactionResult.type === 'toxic' && <div className="effect toxic-effect">☁️☣️</div>}
            </div>
          )}

          {!isAnimating && !reactionResult && (
            <div className="empty-stage">
              <p>Select two chemicals and click Mix.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reactions;
