import React from 'react';
import { Compass, Orbit, Rocket, Crosshair, Sparkles, Eye } from 'lucide-react';

const CelestialInfo = ({ celestialData, loading }) => {
  if (loading) {
    return (
      <div className="glass-panel info-panel" style={{ minHeight: '220px', justifyContent: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-muted)' }}>Calculating celestial alignment...</p>
      </div>
    );
  }

  if (!celestialData) {
    return null;
  }

  const { 
    name, 
    type, 
    constellation, 
    constellationTitle, 
    distanceStr, 
    angularSep, 
    desc, 
    img, 
    ra, 
    dec 
  } = celestialData;

  const imageUrl = img || 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop';

  return (
    <div className="glass-panel info-panel">
      <div className="info-header">
        <Rocket size={22} color="var(--accent-color)" />
        <span className="info-title">Straight Up Indicator</span>
      </div>

      <div className="object-image-container">
        <img src={imageUrl} alt={name} loading="lazy" />
        <div className="badge">{type || 'Celestial Body'}</div>
      </div>

      <div className="data-row">
        <span className="data-label">Closest Celestial Body</span>
        <span className="data-value" style={{ fontSize: '1.25rem', color: '#ffdd44' }}>{name}</span>
      </div>

      {constellation && (
        <div className="data-row">
          <span className="data-label">
            <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Constellation
          </span>
          <span className="data-value" style={{ color: '#38bdf8' }}>
            {constellation} {constellationTitle ? `(${constellationTitle})` : ''}
          </span>
        </div>
      )}

      <div className="data-row">
        <span className="data-label">
          <Orbit size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Distance
        </span>
        <span className="data-value">{distanceStr}</span>
      </div>

      {angularSep != null && (
        <div className="data-row">
          <span className="data-label">
            <Eye size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Angular Separation
          </span>
          <span className="data-value" style={{ color: '#4ade80' }}>
            {angularSep < 0.1 ? 'Direct Zenith Hit (<0.1°)' : `${angularSep.toFixed(2)}° from Zenith`}
          </span>
        </div>
      )}

      {desc && (
        <p style={{ 
          fontSize: '0.82rem', 
          lineHeight: 1.4, 
          color: 'var(--text-muted)', 
          margin: '10px 0 6px', 
          borderLeft: '2px solid var(--accent-color)', 
          paddingLeft: '10px' 
        }}>
          {desc}
        </p>
      )}

      <div className="data-row" style={{ marginTop: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '12px' }}>
        <span className="data-label">
          <Compass size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Right Ascension
        </span>
        <span className="data-value" style={{ color: 'var(--text-main)', textShadow: 'none', fontSize: '0.9rem' }}>
          {(ra / 15).toFixed(2)}h ({ra.toFixed(1)}°)
        </span>
      </div>
      
      <div className="data-row">
        <span className="data-label">
          <Crosshair size={15} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Declination
        </span>
        <span className="data-value" style={{ color: 'var(--text-main)', textShadow: 'none', fontSize: '0.9rem' }}>
          {dec > 0 ? `+${dec.toFixed(2)}°` : `${dec.toFixed(2)}°`}
        </span>
      </div>
    </div>
  );
};

export default CelestialInfo;
