import React, { useState, useEffect } from 'react';
import Map2D from './components/Map2D';
import Globe3D from './components/Globe3D';
import CelestialInfo from './components/CelestialInfo';
import { getClosestObject } from './utils/astronomy';
import { MapPin } from 'lucide-react';
import axios from 'axios';

function App() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [celestialData, setCelestialData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLocationData = async (latitude, longitude) => {
    setLocation({ latitude, longitude });
    setLoading(true);
    try {
      const data = await getClosestObject(latitude, longitude);
      setCelestialData(data);
    } catch (err) {
      console.error("Error finding celestial object:", err);
      setError("Could not calculate celestial data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Immediately start with initial coordinates so the 3D globe and stars render right away
    fetchLocationData(52.2297, 21.0122);

    // 2. Request user's real browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setError(null);
          await fetchLocationData(latitude, longitude);
        },
        async (err) => {
          console.warn("Geolocation prompt was denied or timed out:", err);
          // Try IP lookup fallback
          try {
            const response = await axios.get('https://ipapi.co/json/', { timeout: 3500 });
            if (response.data && response.data.latitude && response.data.longitude) {
              await fetchLocationData(response.data.latitude, response.data.longitude);
            }
          } catch (ipErr) {
            // Already initialized with working coordinates
          }
        },
        { timeout: 6000, maximumAge: 60000 }
      );
    }
  }, []);

  return (
    <div className="app-container">
      {/* 3D Map Area */}
      <div className="map-container">
        {location && <Globe3D latitude={location.latitude} longitude={location.longitude} celestialData={celestialData} />}
      </div>

      {/* Sidebar Overlay */}
      <div className="sidebar">
        {/* Title Bar */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin color="var(--accent-color)" />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Star Locator</h1>
          </div>
          <a href="/" style={{ color: 'var(--text-color)', textDecoration: 'none', fontSize: '0.9rem', opacity: 0.8 }}>
            ← Hub
          </a>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="glass-panel" style={{ padding: '16px', color: '#ff6b6b', border: '1px solid rgba(255, 107, 107, 0.3)' }}>
            {error}
          </div>
        )}
        
        {/* 2D Map Widget */}
        <div className="glass-panel" style={{ padding: '8px' }}>
          <h2 style={{ fontSize: '1rem', padding: '8px 8px 2px', margin: 0 }}>Observer Location</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 8px 6px', margin: 0 }}>
            📍 Click anywhere on map to aim straight up from any city!
          </p>
          <Map2D latitude={location?.latitude} longitude={location?.longitude} onLocationChange={fetchLocationData} />
        </div>

        {/* Celestial Info */}
        <CelestialInfo celestialData={celestialData} loading={loading} />
      </div>
    </div>
  );
}

export default App;
