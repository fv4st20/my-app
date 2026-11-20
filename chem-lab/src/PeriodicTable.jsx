import React, { useState, useMemo, useEffect } from 'react';
import elementsData from './elements.json';

const CATEGORY_COLORS = {
  'diatomic nonmetal': '#3b82f6',
  'noble gas': '#a855f7',
  'alkali metal': '#ef4444',
  'alkaline earth metal': '#f97316',
  metalloid: '#10b981',
  'polyatomic nonmetal': '#06b6d4',
  'post-transition metal': '#f59e0b',
  'transition metal': '#ec4899',
  lanthanide: '#eab308',
  actinide: '#8b5cf6',
  'unknown, probably transition metal': '#6b7280',
  'unknown, probably post-transition metal': '#6b7280',
  'unknown, probably metalloid': '#6b7280',
  'unknown, predicted to be noble gas': '#6b7280',
  'unknown, but predicted to be an alkali metal': '#6b7280'
};

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Categories' },
  { value: 'alkali metal', label: 'Alkali Metals' },
  { value: 'alkaline earth metal', label: 'Alkaline Earth Metals' },
  { value: 'transition metal', label: 'Transition Metals' },
  { value: 'post-transition metal', label: 'Post-Transition Metals' },
  { value: 'metalloid', label: 'Metalloids' },
  { value: 'nonmetal', label: 'Nonmetals (Diatomic & Polyatomic)' },
  { value: 'noble gas', label: 'Noble Gases' },
  { value: 'lanthanide', label: 'Lanthanides' },
  { value: 'actinide', label: 'Actinides' },
  { value: 'unknown', label: 'Unknown / Predicted' }
];

function getElementState(el, temp) {
  if (!el) return 'unknown';
  const { melt, boil, phase } = el;

  if (melt == null && boil == null) {
    if (phase && temp >= 250 && temp <= 350) {
      return String(phase).toLowerCase();
    }
    return 'unknown';
  }

  // Always check boiling / sublimation point first so null melt never shadows boil
  if (boil != null && temp >= boil) {
    return 'gas';
  }

  if (melt != null && boil != null) {
    return temp < melt ? 'solid' : 'liquid';
  }

  if (melt == null && boil != null) {
    if (phase && String(phase).toLowerCase() === 'liquid' && temp >= 250) {
      return 'liquid';
    }
    return 'solid';
  }

  // melt != null && boil == null
  return temp < melt ? 'solid' : 'liquid';
}

const getStateIcon = (state) => {
  if (state === 'solid') return '🧊';
  if (state === 'liquid') return '💧';
  if (state === 'gas') return '☁️';
  return '❓';
};

const PeriodicTable = () => {
  const [selectedElement, setSelectedElement] = useState(null);
  const [temperature, setTemperature] = useState(298); // Room temp in Kelvin
  const [filterQuery, setFilterQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');

  const elements = useMemo(() => (Array.isArray(elementsData?.elements) ? elementsData.elements : []), []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedElement(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const matchesElement = (el, state) => {
    const q = filterQuery.trim().toLowerCase();
    if (q) {
      const byName = String(el.name || '').toLowerCase().includes(q);
      const bySymbol = String(el.symbol || '').toLowerCase() === q || String(el.symbol || '').toLowerCase().includes(q);
      const byNumber = String(el.number) === q;
      if (!byName && !bySymbol && !byNumber) return false;
    }

    if (categoryFilter !== 'all') {
      const cat = String(el.category || '').toLowerCase();
      if (categoryFilter === 'nonmetal') {
        if (!cat.includes('nonmetal')) return false;
      } else if (categoryFilter === 'unknown') {
        if (!cat.startsWith('unknown')) return false;
      } else if (cat !== categoryFilter) {
        return false;
      }
    }

    if (phaseFilter !== 'all' && state !== phaseFilter) {
      return false;
    }

    return true;
  };

  const getElementStyle = (element, state, isMatched) => {
    let stateStyle = {};
    if (state === 'liquid') {
      stateStyle = { borderBottom: '3px solid #3b82f6' };
    } else if (state === 'gas') {
      stateStyle = { borderStyle: 'dashed', borderWidth: '1px', borderColor: 'rgba(255,255,255,0.6)' };
    } else if (state === 'solid') {
      stateStyle = { borderBottom: '3px solid #94a3b8' };
    }

    return {
      gridColumn: element.xpos,
      gridRow: element.ypos,
      backgroundColor: CATEGORY_COLORS[element.category] || '#475569',
      position: 'relative',
      opacity: isMatched ? (state === 'gas' ? 0.78 : 1) : 0.16,
      pointerEvents: 'auto',
      ...stateStyle
    };
  };

  const matchCount = elements.reduce((acc, el) => {
    const st = getElementState(el, temperature);
    return acc + (matchesElement(el, st) ? 1 : 0);
  }, 0);

  const hasActiveFilters = filterQuery.trim() !== '' || categoryFilter !== 'all' || phaseFilter !== 'all';

  return (
    <div className="pt-container">
      <header className="header">
        <h1>Interactive Periodic Table</h1>
        <p>Filter elements by name, symbol, atomic number, or category, and simulate phase transitions across temperatures.</p>
      </header>

      {/* Search, Category & Temperature Controls */}
      <div
        className="temperature-controls glass-panel"
        style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            aria-label="Filter elements"
            placeholder="Search name, symbol, or # (e.g. Gold, Au, 79)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              flex: '1 1 220px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text-main)',
              outline: 'none'
            }}
          />
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text-main)'
            }}
          >
            {CATEGORY_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#0b0f19' }}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by phase at current temperature"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text-main)'
            }}
          >
            <option value="all" style={{ background: '#0b0f19' }}>All States ({temperature} K)</option>
            <option value="solid" style={{ background: '#0b0f19' }}>🧊 Solid</option>
            <option value="liquid" style={{ background: '#0b0f19' }}>💧 Liquid</option>
            <option value="gas" style={{ background: '#0b0f19' }}>☁️ Gas</option>
            <option value="unknown" style={{ background: '#0b0f19' }}>❓ Unknown</option>
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterQuery('');
                setCategoryFilter('all');
                setPhaseFilter('all');
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(236, 72, 153, 0.2)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              Clear ({matchCount}/{elements.length})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <label htmlFor="temp-slider" style={{ fontWeight: 'bold' }}>
            Lab Temperature Sandbox: {temperature} K ({(temperature - 273.15).toFixed(1)} °C)
          </label>
          <button
            type="button"
            onClick={() => setTemperature(298)}
            style={{
              padding: '5px 12px',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            Reset to Room Temp (298 K)
          </button>
        </div>
        <input
          id="temp-slider"
          type="range"
          min="0"
          max="6000"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Absolute Zero (0 K)</span>
          <span>Showing {matchCount} of {elements.length} elements</span>
          <span>Surface of the Sun (~5800 K)</span>
        </div>
      </div>

      <div className="pt-layout">
        {selectedElement && (
          <div className="element-details-panel">
            <button
              type="button"
              aria-label="Close element details"
              className="close-btn"
              onClick={() => setSelectedElement(null)}
            >
              ×
            </button>
            <div
              className="element-header"
              style={{ backgroundColor: CATEGORY_COLORS[selectedElement.category] || '#475569' }}
            >
              <div className="el-big-symbol">{selectedElement.symbol}</div>
              <div>
                <div className="el-big-name">{selectedElement.name}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Atomic #{selectedElement.number}</div>
              </div>
            </div>
            <div className="element-stats">
              <div className="stat">
                <span className="label">State at {temperature} K:</span>
                <span className="value" style={{ textTransform: 'capitalize', color: 'var(--accent)', fontWeight: 'bold' }}>
                  {getStateIcon(getElementState(selectedElement, temperature))}{' '}
                  {getElementState(selectedElement, temperature)}
                </span>
              </div>
              <div className="stat">
                <span className="label">Atomic Mass:</span>
                <span className="value">
                  {Number.isFinite(selectedElement.atomic_mass)
                    ? `${selectedElement.atomic_mass.toFixed(3)} u`
                    : 'Unknown'}
                </span>
              </div>
              <div className="stat">
                <span className="label">Category:</span>
                <span className="value" style={{ textTransform: 'capitalize' }}>
                  {selectedElement.category || 'Unknown'}
                </span>
              </div>
              <div className="stat">
                <span className="label">Melting Point:</span>
                <span className="value">
                  {selectedElement.melt != null ? `${selectedElement.melt} K` : 'Unknown / Sublimes'}
                </span>
              </div>
              <div className="stat">
                <span className="label">Boiling / Sublimation:</span>
                <span className="value">
                  {selectedElement.boil != null ? `${selectedElement.boil} K` : 'Unknown'}
                </span>
              </div>
              <div className="stat">
                <span className="label">Electron Config:</span>
                <span className="value">{selectedElement.electron_configuration || 'Unknown'}</span>
              </div>
              <div className="stat">
                <span className="label">Discovered By:</span>
                <span className="value">{selectedElement.discovered_by || 'Unknown'}</span>
              </div>
              {typeof selectedElement.source === 'string' &&
                /^https:\/\/en\.wikipedia\.org\//.test(selectedElement.source) && (
                  <div className="stat">
                    <span className="label">Reference:</span>
                    <span className="value">
                      <a
                        href={selectedElement.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#38bdf8', textDecoration: 'underline' }}
                      >
                        Wikipedia Article ↗
                      </a>
                    </span>
                  </div>
                )}
            </div>
            <div className="element-desc">
              <p>{selectedElement.summary}</p>
            </div>
          </div>
        )}

        <div className="periodic-table">
          {elements.map((el) => {
            const state = getElementState(el, temperature);
            const isMatched = matchesElement(el, state);
            const isSelected = selectedElement?.number === el.number;
            return (
              <div
                key={el.number}
                role="button"
                tabIndex={0}
                className={`element-cell ${isSelected ? 'selected' : ''} state-${state}`}
                style={getElementStyle(el, state, isMatched)}
                onClick={() => setSelectedElement((prev) => (prev?.number === el.number ? null : el))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedElement((prev) => (prev?.number === el.number ? null : el));
                  }
                }}
                title={`${el.name} (${el.symbol}) — ${state} at ${temperature} K`}
              >
                <span className="el-number">{el.number}</span>
                <span className="el-symbol">{el.symbol}</span>
                <span className="el-name">{el.name}</span>
                <span
                  className="el-state-icon"
                  style={{ position: 'absolute', bottom: '2px', right: '2px', fontSize: '10px' }}
                >
                  {getStateIcon(state)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PeriodicTable;
