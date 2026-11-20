import React, { useState, useCallback } from 'react';
import Map2D from './components/Map2D';
import Globe3D from './components/Globe3D';
import CelestialInfo from './components/CelestialInfo';
import { calculateClosestObject, normalizeCoordinates } from './utils/astronomy';
import { MapPin, Navigation, ShieldCheck } from 'lucide-react';

const DEFAULT_COORDS = { latitude: 52.2297, longitude: 21.0122 };

function App() {
  const [location, setLocation] = useState(DEFAULT_COORDS);
  const [celestialData, setCelestialData] = useState(() =>
    calculateClosestObject(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude)
  );
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);

  const updateLocation = useCallback((rawLat, rawLon) => {
    const { latitude, longitude } = normalizeCoordinates(rawLat, rawLon);
    setLocation({ latitude, longitude });
    setError(null);
    try {
      const data = calculateClosestObject(latitude, longitude);
      setCelestialData(data);
    } catch (err) {
      console.error('Error finding celestial object:', err);
      setError('Could not calculate celestial alignment for those coordinates.');
    }
  }, []);

  // Trigger browser geolocation ONLY on explicit user click — never on page load
  const handleUseMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Browser geolocation is not supported on this device.');
      return;
    }

    setLocating(true);
    setError(null);

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocating(false);
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        (geoErr) => {
          setLocating(false);
          if (geoErr?.code === 1) {
            setError('Location permission denied. Click anywhere on the map instead.');
          } else if (geoErr?.code === 3) {
            setError('Location request timed out. Please select a spot on the map.');
          } else {
            setError('Unable to determine GPS position. Click on the map to choose a location.');
          }
        },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
      );
    } catch {
      setLocating(false);
      setError('Unable to request browser geolocation.');
    }
  };

  return (
    <div className="app-container">
      {/* 3D Map Area */}
      <div className="map-container">
        <Globe3D
          latitude={location.latitude}
          longitude={location.longitude}
          celestialData={celestialData}
        />
      </div>

      {/* Sidebar Overlay */}
      <div className="sidebar">
        {/* Title Bar */}
        <div
          className="glass-panel"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin color="var(--accent-color)" />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Star Locator</h1>
          </div>
          <a
            href="/"
            style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.9rem', opacity: 0.85 }}
          >
            ← Hub
          </a>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="glass-panel"
            role="alert"
            style={{ padding: '12px 16px', color: '#ff8585', border: '1px solid rgba(255, 107, 107, 0.35)', fontSize: '0.85rem' }}
          >
            {error}
          </div>
        )}

        {/* 2D Map Widget + Explicit Geolocation Trigger */}
        <div className="glass-panel" style={{ padding: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '4px 6px 6px'
            }}
          >
            <h2 style={{ fontSize: '0.98rem', margin: 0 }}>Observer Location</h2>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#ffffff',
                background: 'var(--accent-color)',
                border: 'none',
                borderRadius: '8px',
                cursor: locating ? 'wait' : 'pointer',
                opacity: locating ? 0.7 : 1
              }}
            >
              <Navigation size={13} />
              {locating ? 'Locating…' : 'Use My GPS'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 6px 6px', margin: 0 }}>
            📍 Click anywhere on the map ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°) to aim straight up.
          </p>
          <Map2D
            latitude={location.latitude}
            longitude={location.longitude}
            onLocationChange={updateLocation}
          />
          <p
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              padding: '6px 6px 2px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <ShieldCheck size={13} color="#4ade80" style={{ flexShrink: 0 }} />
            Coordinates stay 100% client-side in your browser — never sent to any server.
          </p>
        </div>

        {/* Celestial Info */}
        <CelestialInfo celestialData={celestialData} loading={false} />
      </div>
    </div>
  );
}

export default App;
