import React from 'react';
import { Compass, Orbit, Rocket, Crosshair } from 'lucide-react';

const CelestialInfo = ({ celestialData, loading }) => {
  if (loading) {
    return (
      <div className="glass-panel info-panel" style={{ minHeight: '200px', justifyContent: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-muted)' }}>Scanning the cosmos...</p>
      </div>
    );
  }

  if (!celestialData) {
    return null;
  }

  const { name, type, distanceStr, ra, dec } = celestialData;

  // Generate a placeholder image based on type
  let imageUrl = 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=400&auto=format&fit=crop'; // Deep space
  if (type === 'Moon') imageUrl = 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?q=80&w=400&auto=format&fit=crop';
  else if (type === 'Star') imageUrl = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop'; // Sun
  else if (type === 'Planet' || type === 'Dwarf Planet') imageUrl = 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=80&w=400&auto=format&fit=crop';
  else if (type && type.includes('Star')) imageUrl = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop';

  return (
    <div className="glass-panel info-panel">
      <div className="info-header">
        <Rocket size={24} color="var(--accent-color)" />
        <span className="info-title">Straight Up Indicator</span>
      </div>

      <div className="object-image-container">
        <img src={imageUrl} alt={name} />
        <div className="badge">{type || 'Unknown'}</div>
      </div>

      <div className="data-row">
        <span className="data-label">Closest Object</span>
        <span className="data-value" style={{ fontSize: '1.2rem' }}>{name}</span>
      </div>

      <div className="data-row">
        <span className="data-label"><Orbit size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Distance</span>
        <span className="data-value">{distanceStr}</span>
      </div>

      <div className="data-row" style={{ marginTop: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
        <span className="data-label"><Compass size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Right Ascension</span>
        <span className="data-value" style={{ color: 'var(--text-main)', textShadow: 'none' }}>
          {(ra / 15).toFixed(2)}h
        </span>
      </div>
      
      <div className="data-row">
        <span className="data-label"><Crosshair size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Declination</span>
        <span className="data-value" style={{ color: 'var(--text-main)', textShadow: 'none' }}>
          {dec.toFixed(2)}°
        </span>
      </div>
    </div>
  );
};

export default CelestialInfo;
