import React from 'react';

const Reference = () => {
  return (
    <div className="reference-container">
      <header className="header">
        <h1>Chemistry Reference</h1>
        <p>Quick reference guide for common constants and formulas.</p>
      </header>

      <div className="ref-grid">
        <div className="ref-card">
          <h2>Fundamental Constants</h2>
          <ul>
            <li>
              <strong>Avogadro's Number (N_A):</strong> 
              <span>6.022 × 10²³ mol⁻¹</span>
            </li>
            <li>
              <strong>Ideal Gas Constant (R):</strong> 
              <span>8.314 J/(mol·K)</span>
              <span>0.08206 L·atm/(mol·K)</span>
            </li>
            <li>
              <strong>Planck's Constant (h):</strong> 
              <span>6.626 × 10⁻³⁴ J·s</span>
            </li>
            <li>
              <strong>Speed of Light (c):</strong> 
              <span>2.998 × 10⁸ m/s</span>
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
              <strong>pH Equation:</strong> 
              <span className="formula-text">pH = -log[H⁺]</span>
            </li>
            <li>
              <strong>Gibbs Free Energy:</strong> 
              <span className="formula-text">ΔG = ΔH - TΔS</span>
            </li>
          </ul>
        </div>
        
        <div className="ref-card full-width">
          <h2>Stoichiometry Steps</h2>
          <ol className="steps-list">
            <li>Balance the chemical equation.</li>
            <li>Convert the given mass (or volume) of the reactant to moles.</li>
            <li>Use the molar ratio from the balanced equation to find moles of the desired product.</li>
            <li>Convert the moles of product back to mass (or volume) if required.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Reference;
