import React, { useState } from 'react';
import elementsData from './elements.json';

const PeriodicTable = () => {
  const [selectedElement, setSelectedElement] = useState(null);
  const [temperature, setTemperature] = useState(298); // Room temp in Kelvin

  const elements = elementsData.elements || [];

  // Group styling map
  const categoryColors = {
    "diatomic nonmetal": "#3b82f6",
    "noble gas": "#a855f7",
    "alkali metal": "#ef4444",
    "alkaline earth metal": "#f97316",
    "metalloid": "#10b981",
    "polyatomic nonmetal": "#06b6d4",
    "post-transition metal": "#f59e0b",
    "transition metal": "#ec4899",
    "lanthanide": "#eab308",
    "actinide": "#8b5cf6",
    "unknown, probably transition metal": "#6b7280",
    "unknown, probably post-transition metal": "#6b7280",
    "unknown, probably metalloid": "#6b7280",
    "unknown, predicted to be noble gas": "#6b7280",
    "unknown, but predicted to be an alkali metal": "#6b7280"
  };

  const getElementState = (el, temp) => {
    if (el.melt === null && el.boil === null) return 'unknown';
    
    // Some elements only have melt or boil, make best guess or fallback
    const melt = el.melt !== null ? el.melt : Infinity;
    const boil = el.boil !== null ? el.boil : Infinity;

    if (temp < melt) return 'solid';
    if (temp >= melt && temp < boil) return 'liquid';
    if (temp >= boil) return 'gas';
    return 'unknown';
  };

  const getElementStyle = (element) => {
    const state = getElementState(element, temperature);
    
    let stateStyle = {};
    if (state === 'liquid') {
      stateStyle = { borderBottom: '3px solid #3b82f6', opacity: 0.9 };
    } else if (state === 'gas') {
      stateStyle = { opacity: 0.6, borderStyle: 'dashed' };
    } else if (state === 'solid') {
      stateStyle = { borderBottom: '3px solid #94a3b8' };
    }

    return {
      gridColumn: element.xpos,
      gridRow: element.ypos,
      backgroundColor: categoryColors[element.category] || "#475569",
      ...stateStyle
    };
  };

  const getStateIcon = (state) => {
    if (state === 'solid') return '🧊';
    if (state === 'liquid') return '💧';
    if (state === 'gas') return '☁️';
    return '❓';
  };

  return (
    <div className="pt-container">
      <header className="header">
        <h1>Interactive Periodic Table</h1>
        <p>Explore elements and see how they change state based on temperature.</p>
      </header>

      <div className="temperature-controls glass-panel" style={{ padding: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>Lab Temperature Sandbox: {temperature} K ({(temperature - 273.15).toFixed(1)} °C)</label>
          <button onClick={() => setTemperature(298)} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>Reset to Room Temp</button>
        </div>
        <input 
          type="range" 
          min="0" 
          max="6000" 
          value={temperature} 
          onChange={(e) => setTemperature(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Absolute Zero (0 K)</span>
          <span>Surface of the Sun (~5800 K)</span>
        </div>
      </div>

      <div className="pt-layout">
        <div className="periodic-table">
          {elements.map((el) => {
            const state = getElementState(el, temperature);
            return (
              <div 
                key={el.number} 
                className={`element-cell ${selectedElement?.number === el.number ? 'selected' : ''} state-${state}`}
                style={getElementStyle(el)}
                onClick={() => setSelectedElement(el)}
                title={`${el.name} - ${state}`}
              >
                <span className="el-number">{el.number}</span>
                <span className="el-symbol">{el.symbol}</span>
                <span className="el-name">{el.name}</span>
                <span className="el-state-icon" style={{ position: 'absolute', bottom: '2px', right: '2px', fontSize: '10px' }}>{getStateIcon(state)}</span>
              </div>
            );
          })}
        </div>

        {selectedElement && (
          <div className="element-details-panel">
            <button className="close-btn" onClick={() => setSelectedElement(null)}>×</button>
            <div className="element-header" style={{ backgroundColor: categoryColors[selectedElement.category] || '#475569' }}>
              <div className="el-big-symbol">{selectedElement.symbol}</div>
              <div className="el-big-name">{selectedElement.name}</div>
            </div>
            <div className="element-stats">
              <div className="stat"><span className="label">Current State:</span> <span className="value" style={{textTransform: 'capitalize', color: 'var(--accent-color)', fontWeight: 'bold'}}>{getStateIcon(getElementState(selectedElement, temperature))} {getElementState(selectedElement, temperature)} at {temperature}K</span></div>
              <div className="stat"><span className="label">Atomic Number:</span> <span className="value">{selectedElement.number}</span></div>
              <div className="stat"><span className="label">Atomic Mass:</span> <span className="value">{selectedElement.atomic_mass.toFixed(3)}</span></div>
              <div className="stat"><span className="label">Category:</span> <span className="value" style={{textTransform: 'capitalize'}}>{selectedElement.category}</span></div>
              <div className="stat"><span className="label">Melting Point:</span> <span className="value">{selectedElement.melt ? `${selectedElement.melt} K` : 'Unknown'}</span></div>
              <div className="stat"><span className="label">Boiling Point:</span> <span className="value">{selectedElement.boil ? `${selectedElement.boil} K` : 'Unknown'}</span></div>
              <div className="stat"><span className="label">Electron Config:</span> <span className="value">{selectedElement.electron_configuration}</span></div>
              <div className="stat"><span className="label">Discovered By:</span> <span className="value">{selectedElement.discovered_by || 'Unknown'}</span></div>
            </div>
            <div className="element-desc">
              <p>{selectedElement.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PeriodicTable;
