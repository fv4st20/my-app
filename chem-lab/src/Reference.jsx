import React from 'react';

const Reference = () => {
  return (
    <div className="reference-container">
      <header className="header">
        <h1>Chemistry Reference &amp; Lab Safety</h1>
        <p>Quick reference guide for fundamental SI constants, core equations, stoichiometry, and laboratory safety.</p>
      </header>

      <div className="ref-grid">
        <div className="ref-card">
          <h2>Fundamental Constants</h2>
          <ul>
            <li>
              <strong>Avogadro&apos;s Constant (Nₐ):</strong>
              <span>6.02214076 × 10²³ mol⁻¹</span>
            </li>
            <li>
              <strong>Ideal Gas Constant (R):</strong>
              <span>8.31446 J/(mol·K)</span>
              <span>0.082057 L·atm/(mol·K)</span>
            </li>
            <li>
              <strong>Planck&apos;s Constant (h):</strong>
              <span>6.62607015 × 10⁻³⁴ J·s</span>
            </li>
            <li>
              <strong>Speed of Light in Vacuum (c):</strong>
              <span>2.99792458 × 10⁸ m/s</span>
            </li>
          </ul>
        </div>

        <div className="ref-card">
          <h2>Essential Formulas</h2>
          <ul>
            <li>
              <strong>Ideal Gas Law:</strong>
              <span className="formula-text">PV = nRT</span>
            </li>
            <li>
              <strong>Molarity (M):</strong>
              <span className="formula-text">M = moles of solute / liters of solution</span>
            </li>
            <li>
              <strong>pH &amp; pOH Relations (at 298 K):</strong>
              <span className="formula-text">pH = −log₁₀[H⁺],  pH + pOH = 14</span>
            </li>
            <li>
              <strong>Gibbs Free Energy:</strong>
              <span className="formula-text">ΔG = ΔH − TΔS</span>
            </li>
          </ul>
        </div>

        <div className="ref-card full-width">
          <h2>Stoichiometry Steps</h2>
          <ol className="steps-list">
            <li>Balance the chemical equation so atom counts and net charge match on both sides.</li>
            <li>Convert the given mass, volume, or particle count of reactant into moles.</li>
            <li>Apply the stoichiometric molar ratio (limiting reagent first) to determine moles of product.</li>
            <li>Convert moles of desired product into target units (grams, liters, or molarity).</li>
          </ol>
        </div>

        <div className="ref-card full-width">
          <h2>Core Laboratory Safety Rules</h2>
          <ul>
            <li>
              <strong>Personal Protective Equipment (PPE):</strong>
              <span>Always wear splash-rated chemical goggles, lab coat, closed-toe shoes, and compatible gloves.</span>
            </li>
            <li>
              <strong>Never Mix Household Cleaners:</strong>
              <span>Never combine bleach (NaClO) with ammonia or acids—doing so releases lethal chloramine or chlorine gas.</span>
            </li>
            <li>
              <strong>Diluting Acids Safely:</strong>
              <span>Always add concentrated acid slowly into water while stirring—never pour water into concentrated acid.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Reference;
