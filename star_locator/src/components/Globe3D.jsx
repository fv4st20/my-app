import React, { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';

const Globe3D = ({ latitude, longitude, celestialData }) => {
  const globeEl = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [countries, setCountries] = useState({ features: [] });
  const [arcs, setArcs] = useState([]);
  const [colorMode, setColorMode] = useState('normal');

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        const enrichedFeatures = data.features.map(f => ({
            ...f,
            cultureScore: Math.floor(Math.random() * 40) + 60,
            natureScore: Math.floor(Math.random() * 40) + 60,
            tempScore: Math.floor(Math.random() * 60) - 20,
            topoScore: Math.floor(Math.random() * 5000),
            color: `rgba(${Math.floor(Math.random() * 50)}, ${100 + Math.floor(Math.random() * 155)}, ${150 + Math.floor(Math.random() * 105)}, 0.4)`
        }));
        setCountries({ ...data, features: enrichedFeatures });
      })
      .catch(err => console.error("Could not load geojson", err));
      
    const N = 50;
    const arcsData = [...Array(N).keys()].map(() => ({
      startLat: (Math.random() - 0.5) * 180,
      startLng: (Math.random() - 0.5) * 360,
      endLat: (Math.random() - 0.5) * 180,
      endLng: (Math.random() - 0.5) * 360,
      color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][Math.floor(Math.random() * 4)],
      icon: Math.random() > 0.5 ? '✈️' : '🚢'
    }));
    setArcs(arcsData);
  }, []);

  useEffect(() => {
    if (globeEl.current && latitude && longitude) {
      // Auto-rotate and position the globe to center on the user
      globeEl.current.pointOfView({ lat: latitude, lng: longitude, altitude: 2.5 }, 2000);
    }
  }, [latitude, longitude]);

  if (!latitude || !longitude) return null;

  // Vector pointing straight up from the user's location
  // We represent this as an arc that starts at the user's location and ends at a point slightly offset to visualize it,
  // or a custom 3D object. The simplest using built-in globe features is a path or a ring.
  // Actually, we can use \`pathsData\` to draw a line that goes straight up.
  // Since Globe.gl paths follow the surface, drawing a straight line OUT is better done via \`customLayerData\`.
  // To keep it simple, we'll draw a marker at the location, and an "arc" to a high altitude above the same point.
  
  const elementsData = [{
    lat: latitude,
    lng: longitude,
    alt: 0.01,
    size: 20,
    color: '#7b61ff',
    isCelestial: false
  }];

  if (celestialData) {
    let size = 45;
    let color = '#ffdd44';
    let type = (celestialData.type || '').toLowerCase();

    if (type.includes('supergiant')) { size = 65; color = '#ffaa33'; }
    else if (type.includes('giant')) { size = 55; color = '#ffcc44'; }
    else if (type.includes('star')) { size = 48; color = '#ffee66'; }
    else if (type.includes('planet')) { size = 45; color = '#38bdf8'; }
    else if (type.includes('galaxy')) { size = 60; color = '#c084fc'; }
    else if (type.includes('cluster') || type.includes('nebula')) { size = 55; color = '#ec4899'; }
    else if (type.includes('moon')) { size = 38; color = '#f1f5f9'; }

    elementsData.push({
      lat: latitude,
      lng: longitude,
      alt: 1.5,
      size: size,
      color: color,
      isCelestial: true,
      name: celestialData.name,
      distanceStr: celestialData.distanceStr,
      constellation: celestialData.constellation
    });
  }

  // Add vehicles at the start of each arc
  arcs.forEach((arc, i) => {
    elementsData.push({
      lat: arc.startLat,
      lng: arc.startLng,
      alt: arc.icon === '✈️' ? 0.05 : 0.01,
      size: 20,
      color: arc.color,
      isVehicle: true,
      icon: arc.icon,
      id: `vehicle-${i}`
    });
  });

  // We can create a path from surface to a high altitude
  const pathData = [{
    coords: [
      [latitude, longitude, 0], // surface
      [latitude, longitude, 1.5] // high altitude
    ],
    color: 'rgba(123, 97, 255, 0.8)'
  }];

  const getPolygonColor = (d) => {
    if (colorMode === 'normal') return 'rgba(0, 0, 0, 0)';
    if (colorMode === 'random') return d.color;
    
    const pop = d.properties ? d.properties.POP_EST : 0;
    
    if (colorMode === 'population') {
      if (pop > 100000000) return 'rgba(239, 68, 68, 0.6)'; // Red
      if (pop > 50000000) return 'rgba(249, 115, 22, 0.6)'; // Orange
      if (pop > 10000000) return 'rgba(234, 179, 8, 0.6)'; // Yellow
      return 'rgba(34, 197, 94, 0.6)'; // Green
    }
    if (colorMode === 'nature') {
      return `rgba(${Math.floor(255 - d.natureScore * 2.5)}, ${Math.floor(d.natureScore * 2.5)}, 100, 0.6)`;
    }
    if (colorMode === 'culture') {
      return `rgba(${Math.floor(d.cultureScore * 2.5)}, 100, ${Math.floor(255 - d.cultureScore * 2.5)}, 0.6)`;
    }
    if (colorMode === 'temperature') {
      const t = (d.tempScore + 20) / 60; // 0 to 1
      return `rgba(${Math.floor(t * 255)}, 0, ${Math.floor((1 - t) * 255)}, 0.6)`;
    }
    if (colorMode === 'topography') {
      const topo = d.topoScore / 5000;
      return `rgba(${Math.floor(100 + topo * 155)}, ${Math.floor(200 - topo * 100)}, ${Math.floor(topo * 150)}, 0.8)`;
    }
    return 'rgba(0,0,0,0)';
  };

  return (
    <div className="globe-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {/* Control Panel overlay for earth colors */}
      <div style={{ position: 'absolute', bottom: '30px', left: '30px', zIndex: 10, background: 'rgba(15, 23, 42, 0.9)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>Earth Overlay</h3>
        <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #475569', outline: 'none', cursor: 'pointer' }}>
          <option value="normal">🌍 Normal Earth</option>
          <option value="random">🎨 Random Colors</option>
          <option value="population">👥 Population Density</option>
          <option value="nature">🌿 Nature Index</option>
          <option value="culture">🎭 Culture Index</option>
          <option value="temperature">🌡️ Avg Temperature</option>
          <option value="topography">⛰️ Topography</option>
        </select>
      </div>

      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Countries (Polygons)
        polygonsData={countries.features}
        polygonAltitude={0.006}
        polygonCapColor={getPolygonColor}
        polygonSideColor={() => 'rgba(0, 50, 0, 0.15)'}
        polygonStrokeColor={() => '#111'}
        polygonLabel={(feature) => {
          const { properties: d = {}, cultureScore, natureScore, tempScore, topoScore } = feature;
          return `
          <div style="background: rgba(15, 23, 42, 0.9); padding: 12px; border-radius: 8px; border: 1px solid #38bdf8; color: white; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <b style="font-size: 16px; color: #38bdf8;">${d.ADMIN || 'Unknown'} (${d.ISO_A2 || 'N/A'})</b> <br />
            <div style="margin-top: 5px; font-size: 13px;">
              Population: <i>${d.POP_EST ? (d.POP_EST / 1000000).toFixed(1) : 0}M</i> <br />
              Temperature: <span style="color: #f87171;">${tempScore}°C</span> <br />
              Elevation: <span style="color: #fbbf24;">~${topoScore}m</span> <br />
              Nature Index: <span style="color: #4ade80;">${natureScore}/100</span> <br />
              Culture Index: <span style="color: #f472b6;">${cultureScore}/100</span>
            </div>
          </div>
        `}}
        polygonHoverColor={() => 'rgba(255, 255, 255, 0.5)'}

        // Transport Tracker (Arcs)
        arcsData={arcs}
        arcStartLat={d => d.startLat}
        arcStartLng={d => d.startLng}
        arcEndLat={d => d.endLat}
        arcEndLng={d => d.endLng}
        arcColor={d => d.color}
        arcDashLength={0.4}
        arcDashGap={4}
        arcDashInitialGap={() => Math.random() * 5}
        arcDashAnimateTime={2000}

        // Markers
        htmlElementsData={elementsData}
        htmlElement={(d) => {
          const el = document.createElement('div');
          if (d.isCelestial) {
            el.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer;">
                <div style="width: ${d.size}px; height: ${d.size}px; background: radial-gradient(circle at 35% 35%, #ffffff, ${d.color} 55%, #050510); border-radius: 50%; box-shadow: 0 0 25px ${d.color}, 0 0 50px ${d.color}; border: 2px solid #ffffff;"></div>
                <div style="margin-top: 8px; background: rgba(5, 5, 20, 0.88); border: 1.5px solid ${d.color}; color: #ffffff; padding: 4px 10px; border-radius: 12px; font-family: sans-serif; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.7); backdrop-filter: blur(8px);">
                  ✨ ${d.name} ${d.distanceStr ? `• ${d.distanceStr}` : ''}
                </div>
              </div>
            `;
            el.style.transform = `translate(-50%, -50%)`;
          } else if (d.isVehicle) {
            el.innerHTML = `<div style="font-size: 18px; filter: drop-shadow(0 0 8px ${d.color});">${d.icon}</div>`;
            el.style.transform = `translate(-50%, -50%)`;
          } else {
            el.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
                <div style="width: 16px; height: 16px; background: #6366f1; border-radius: 50%; box-shadow: 0 0 15px #6366f1; border: 2px solid white;"></div>
                <div style="margin-top: 4px; background: rgba(0,0,0,0.85); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 600; white-space: nowrap;">You Are Here</div>
              </div>
            `;
            el.style.transform = `translate(-50%, -50%)`;
          }
          return el;
        }}
        htmlAltitude={(d) => d.alt}

        // Vector line pointing straight up into space to the star
        pathsData={pathData}
        pathPoints="coords"
        pathPointAlt={(p) => p[2]}
        pathColor={() => 'rgba(99, 102, 241, 0.85)'}
        pathResolution={64}
        pathStroke={4}
      />
    </div>
  );
};

export default Globe3D;
