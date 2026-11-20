import React, { useState, useRef, useEffect } from 'react';

const CHEMICALS = [
  { id: 'water', name: 'Water (H₂O)', icon: '💧' },
  { id: 'sodium', name: 'Sodium Metal (Na)', icon: '🧊' },
  { id: 'hcl', name: 'Hydrochloric Acid (HCl)', icon: '🧪' },
  { id: 'naoh', name: 'Sodium Hydroxide (NaOH)', icon: '🧪' },
  { id: 'coke', name: 'Diet Coke (Carbonated Acidic)', icon: '🥤' },
  { id: 'mentos', name: 'Mentos Candy', icon: '🍬' },
  { id: 'bleach', name: 'Household Bleach (NaClO)', icon: '🧴' },
  { id: 'ammonia', name: 'Ammonia Solution (NH₃)', icon: '🧴' }
];

function computeReaction(a, b) {
  if (a === b) {
    const chem = CHEMICALS.find((c) => c.id === a);
    return {
      title: 'Same Substance (No Reaction)',
      desc: `Combining ${chem ? chem.name : a} with itself simply increases total volume with no chemical change.`,
      type: 'neutral',
      eq: 'No net chemical reaction'
    };
  }

  const pair = [a, b].sort().join('+');

  switch (pair) {
    case 'sodium+water':
      return {
        title: 'Violent Exothermic Reaction!',
        desc: 'Metallic sodium reacts rapidly with water to produce corrosive sodium hydroxide and flammable hydrogen gas, which frequently ignites.',
        type: 'explosion',
        eq: '2Na(s) + 2H₂O(l) → 2NaOH(aq) + H₂(g)↑'
      };
    case 'hcl+sodium':
      return {
        title: 'Extreme Acid-Metal Explosion!',
        desc: 'DANGER (Simulation Only): Metallic sodium reacts even more violently with hydrochloric acid than with water, releasing extreme heat and hydrogen gas.',
        type: 'explosion',
        eq: '2Na(s) + 2HCl(aq) → 2NaCl(aq) + H₂(g)↑'
      };
    case 'ammonia+sodium':
    case 'bleach+sodium':
    case 'coke+sodium':
    case 'naoh+sodium':
      return {
        title: 'Violent Aqueous Sodium Reaction!',
        desc: 'Aqueous solutions contain water that violently oxidizes metallic sodium, releasing flammable hydrogen gas and intense heat.',
        type: 'explosion',
        eq: '2Na(s) + 2H₂O(l) → 2NaOH(aq) + H₂(g)↑'
      };
    case 'hcl+naoh':
      return {
        title: 'Exothermic Acid-Base Neutralization',
        desc: 'Strong hydrochloric acid and strong sodium hydroxide base neutralize each other to form aqueous table salt (NaCl), water, and heat.',
        type: 'neutralization',
        eq: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)'
      };
    case 'ammonia+hcl':
      return {
        title: 'Acid-Base Reaction (White Fumes)',
        desc: 'Ammonia reacts with hydrochloric acid to form ammonium chloride, visible as dense white vapor when concentrated.',
        type: 'neutralization',
        eq: 'NH₃(aq) + HCl(aq) → NH₄Cl(aq)'
      };
    case 'coke+mentos':
      return {
        title: 'Rapid CO₂ Nucleation Geyser!',
        desc: 'Microscopic pits on the Mentos surface act as nucleation sites for dissolved carbon dioxide, triggering a rapid physical foam geyser.',
        type: 'geyser',
        eq: 'CO₂(aq) → CO₂(g)↑ (Physical Nucleation)'
      };
    case 'ammonia+bleach':
      return {
        title: 'TOXIC GAS HAZARD: Chloramine!',
        desc: 'DANGER — NEVER MIX IN REAL LIFE! Bleach and ammonia react to release toxic chloramine vapors that cause severe respiratory injury.',
        type: 'toxic',
        eq: 'NH₃(aq) + NaClO(aq) → NH₂Cl(g)↑ + NaOH(aq)'
      };
    case 'bleach+hcl':
      return {
        title: 'DEADLY GAS HAZARD: Chlorine Gas!',
        desc: 'EXTREME DANGER — NEVER MIX IN REAL LIFE! Mixing bleach with any acid releases lethal yellow-green chlorine gas (Cl₂).',
        type: 'toxic',
        eq: 'NaClO(aq) + 2HCl(aq) → Cl₂(g)↑ + NaCl(aq) + H₂O(l)'
      };
    case 'bleach+coke':
      return {
        title: 'Hazardous Acidic Bleach Reaction!',
        desc: 'WARNING: Phosphoric and carbonic acids in soda lower the pH of bleach, risking release of irritating toxic chlorine fumes.',
        type: 'toxic',
        eq: 'NaClO(aq) + H⁺(aq) ⇌ HClO(aq) → Cl₂(g)↑'
      };
    case 'coke+naoh':
      return {
        title: 'Acid Neutralization',
        desc: 'Sodium hydroxide neutralizes the carbonic and phosphoric acids in Diet Coke, absorbing dissolved CO₂ into sodium carbonate/bicarbonate.',
        type: 'neutralization',
        eq: 'H₂CO₃(aq) + 2NaOH(aq) → Na₂CO₃(aq) + 2H₂O(l)'
      };
    case 'hcl+water':
    case 'naoh+water':
      return {
        title: 'Exothermic Dilution',
        desc: 'Dissolving/diluting strong acid or strong base in water releases heat. In real labs: always add acid slowly to water, never water to concentrated acid!',
        type: 'neutral',
        eq: 'Aqueous Dilution (ΔH < 0)'
      };
    case 'ammonia+water':
    case 'bleach+water':
    case 'coke+water':
      return {
        title: 'Aqueous Dilution',
        desc: 'Water dilutes the concentration of the solution without producing a hazardous byproduct.',
        type: 'neutral',
        eq: 'Physical Dilution'
      };
    case 'hcl+mentos':
      return {
        title: 'Acidic Dissolution',
        desc: 'Hydrochloric acid slowly dissolves the sugar and gum arabic coating of the candy without carbonated geyser nucleation.',
        type: 'neutral',
        eq: 'Sucrose Hydrolysis / Dissolution'
      };
    case 'mentos+water':
      return {
        title: 'Slow Sugar Dissolution',
        desc: 'Unlike carbonated soda, flat water contains no pressurized CO₂ gas—so the Mentos candy simply dissolves calmly.',
        type: 'neutral',
        eq: 'C₁₂H₂₂O₁₁(s) → C₁₂H₂₂O₁₁(aq)'
      };
    default:
      return {
        title: 'No Significant Reaction',
        desc: 'Under standard conditions, mixing these two items produces a physical mixture or mild equilibrium shift without dramatic reaction.',
        type: 'neutral',
        eq: 'No dramatic reaction'
      };
  }
}

const Reactions = () => {
  const [reactantA, setReactantA] = useState('');
  const [reactantB, setReactantB] = useState('');
  const [reactionResult, setReactionResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const mixTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mixTimerRef.current !== null) {
        clearTimeout(mixTimerRef.current);
      }
    };
  }, []);

  const handleMix = () => {
    if (!reactantA || !reactantB || isAnimating) return;

    const chosenA = reactantA;
    const chosenB = reactantB;
    setIsAnimating(true);
    setReactionResult(null);

    if (mixTimerRef.current !== null) {
      clearTimeout(mixTimerRef.current);
    }

    mixTimerRef.current = setTimeout(() => {
      mixTimerRef.current = null;
      setIsAnimating(false);
      setReactionResult(computeReaction(chosenA, chosenB));
    }, 1200);
  };

  const handleSelectA = (val) => {
    setReactantA(val);
    setReactionResult(null);
  };

  const handleSelectB = (val) => {
    setReactantB(val);
    setReactionResult(null);
  };

  return (
    <div className="reactions-container">
      <header className="header">
        <h1>Interactive Lab Bench (Simulation)</h1>
        <p>Select two reagents to simulate chemical &amp; physical interactions safely in your browser.</p>
      </header>

      <div className="lab-bench glass-panel">
        <div className="selectors">
          <div className="selector">
            <label htmlFor="reactant-a" style={{ fontWeight: 'bold' }}>Reactant A</label>
            <select
              id="reactant-a"
              value={reactantA}
              disabled={isAnimating}
              onChange={(e) => handleSelectA(e.target.value)}
            >
              <option value="">-- Select Chemical --</option>
              {CHEMICALS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mix-control" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="mix-btn"
              onClick={handleMix}
              disabled={!reactantA || !reactantB || isAnimating}
            >
              {isAnimating ? 'MIXING...' : 'MIX CHEMICALS'}
            </button>
            {(reactantA || reactantB || reactionResult) && !isAnimating && (
              <button
                type="button"
                onClick={() => {
                  setReactantA('');
                  setReactantB('');
                  setReactionResult(null);
                }}
                style={{
                  padding: '15px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            )}
          </div>

          <div className="selector">
            <label htmlFor="reactant-b" style={{ fontWeight: 'bold' }}>Reactant B</label>
            <select
              id="reactant-b"
              value={reactantB}
              disabled={isAnimating}
              onChange={(e) => handleSelectB(e.target.value)}
            >
              <option value="">-- Select Chemical --</option>
              {CHEMICALS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="reaction-stage">
          {isAnimating && (
            <div className="animating-flask" aria-label="Mixing chemicals">
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
              <p>Select two chemicals above and click Mix Chemicals to run the virtual simulation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reactions;
