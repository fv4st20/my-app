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

    const tryIPFallback = async () => {
      try {
        const response = await axios.get('https://ipapi.co/json/');
        if (response.data && response.data.latitude && response.data.longitude) {
          setError("Using IP-based location (browser location was unavailable).");
          await fetchLocationData(response.data.latitude, response.data.longitude);
          return true;
        }
      } catch (err) {
        console.error("IP fallback also failed:", err);
      }
      return false;
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setError(null);
          await fetchLocationData(latitude, longitude);
        },
        async (err) => {
          console.error("Geolocation error:", err);
          setError("Browser location failed. Attempting IP fallback...");
          const success = await tryIPFallback();
          if (!success) {
            setError("Could not access your location. Please enable location services.");
            setLoading(false);
          }
        },
        { timeout: 10000, maximumAge: 0 }
      );
    } else {
      setError("Geolocation not supported. Attempting IP fallback...");
      tryIPFallback().then((success) => {
        if (!success) {
          setError("Geolocation is not supported by your browser.");
          setLoading(false);
        }
      });
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
          <h2 style={{ fontSize: '1rem', padding: '8px', margin: 0 }}>Your Location</h2>
          <Map2D latitude={location?.latitude} longitude={location?.longitude} onLocationChange={fetchLocationData} />
        </div>

        {/* Celestial Info */}
        <CelestialInfo celestialData={celestialData} loading={loading} />
      </div>
    </div>
  );
}

export default App;
