import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';

const ARC_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308'];

// Deterministic pseudo-random generator for decorative flight/ship arcs (pure, no render-time randomness)
function createDeterministicArcs(count = 40) {
  let seed = 421337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  return Array.from({ length: count }, (_, i) => ({
    id: `arc-${i}`,
    startLat: (nextRand() - 0.5) * 160,
    startLng: (nextRand() - 0.5) * 360,
    endLat: (nextRand() - 0.5) * 160,
    endLng: (nextRand() - 0.5) * 360,
    dashOffset: nextRand() * 5,
    color: ARC_COLORS[i % ARC_COLORS.length],
    icon: i % 2 === 0 ? '✈️' : '🚢'
  }));
}

const INITIAL_ARCS = createDeterministicArcs(40);

function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TEXTURE_KEYS = [
  'map',
  'bumpMap',
  'normalMap',
  'specularMap',
  'roughnessMap',
  'metalnessMap',
  'alphaMap',
  'aoMap',
  'emissiveMap',
  'lightMap',
  'envMap'
];

function disposeMaterial(mat) {
  if (!mat) return;
  for (const key of TEXTURE_KEYS) {
    if (mat[key] && typeof mat[key].dispose === 'function') {
      mat[key].dispose();
    }
  }
  if (typeof mat.dispose === 'function') {
    mat.dispose();
  }
}

function disposeGlobeResources(globe) {
  if (!globe) return;
  try {
    globe.pauseAnimation?.();
    globe.polygonsData?.([]);
    globe.arcsData?.([]);
    globe.pathsData?.([]);
    globe.htmlElementsData?.([]);

    const controls = globe.controls?.();
    controls?.dispose?.();

    const scene = globe.scene?.();
    if (scene) {
      if (scene.background && typeof scene.background.dispose === 'function') {
        scene.background.dispose();
      }
      if (scene.environment && typeof scene.environment.dispose === 'function') {
        scene.environment.dispose();
      }
      scene.traverse?.((obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (Array.isArray(obj.material)) {
          obj.material.forEach(disposeMaterial);
        } else if (obj.material) {
          disposeMaterial(obj.material);
        }
      });
    }

    const renderer = globe.renderer?.();
    if (renderer) {
      renderer.renderLists?.dispose?.();
      renderer.dispose?.();
      renderer.forceContextLoss?.();
    }
  } catch {
    // Ignore teardown errors if WebGL context was already lost
  }
}

const Globe3D = ({ latitude, longitude, celestialData }) => {
  const globeEl = useRef(null);
  const [globeHolder] = useState(() => ({ instance: null }));
  const isMountedRef = useRef(false);
  const resizeRafRef = useRef(null);

  const handleGlobeRef = useCallback(
    (instance) => {
      globeEl.current = instance;
      if (instance) {
        globeHolder.instance = instance;
      }
    },
    [globeHolder]
  );

  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  }));
  const [countries, setCountries] = useState({ features: [] });
  const [colorMode, setColorMode] = useState('normal');

  const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  // RAF-throttled window resize listener with full cleanup
  useEffect(() => {
    const handleResize = () => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, []);

  // Load country polygons with AbortController cleanup
  useEffect(() => {
    const controller = new AbortController();

    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data?.features)) return;
        const enrichedFeatures = data.features.map((f, idx) => {
          const h = hashString(f?.properties?.ADMIN || f?.properties?.ISO_A2 || idx);
          return {
            ...f,
            cultureScore: 60 + (h % 40),
            natureScore: 60 + ((h >>> 6) % 40),
            tempScore: ((h >>> 12) % 60) - 20,
            topoScore: (h >>> 16) % 5000,
            color: `rgba(${h % 50}, ${100 + ((h >>> 4) % 155)}, ${150 + ((h >>> 8) % 105)}, 0.4)`
          };
        });
        setCountries({ ...data, features: enrichedFeatures });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          // Offline or blocked GeoJSON simply renders globe texture without country polygons
        }
      });

    return () => controller.abort();
  }, []);

  // Dispose Three.js / WebGL resources on true component unmount (StrictMode-safe)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const globeInstance = globeEl.current || globeHolder.instance;
      queueMicrotask(() => {
        if (!isMountedRef.current && globeInstance) {
          globeHolder.instance = null;
          disposeGlobeResources(globeInstance);
        }
      });
    };
  }, [globeHolder]);

  useEffect(() => {
    if (globeEl.current && hasValidCoords) {
      globeEl.current.pointOfView({ lat: latitude, lng: longitude, altitude: 2.5 }, 1500);
    }
  }, [latitude, longitude, hasValidCoords]);

  const elementsData = useMemo(() => {
    if (!hasValidCoords) return [];

    const items = [
      {
        id: 'observer-marker',
        lat: latitude,
        lng: longitude,
        alt: 0.01,
        size: 16,
        color: '#6366f1',
        isCelestial: false,
        isVehicle: false
      }
    ];

    if (celestialData) {
      let size = 45;
      let color = '#ffdd44';
      const type = String(celestialData.type || '').toLowerCase();

      if (type.includes('supergiant')) {
        size = 65;
        color = '#ffaa33';
      } else if (type.includes('giant')) {
        size = 55;
        color = '#ffcc44';
      } else if (type.includes('star')) {
        size = 48;
        color = '#ffee66';
      } else if (type.includes('planet')) {
        size = 45;
        color = '#38bdf8';
      } else if (type.includes('galaxy')) {
        size = 60;
        color = '#c084fc';
      } else if (type.includes('cluster') || type.includes('nebula')) {
        size = 55;
        color = '#ec4899';
      } else if (type.includes('moon') || type.includes('satellite')) {
        size = 38;
        color = '#f1f5f9';
      }

      items.push({
        id: 'celestial-marker',
        lat: latitude,
        lng: longitude,
        alt: 1.5,
        size,
        color,
        isCelestial: true,
        isVehicle: false,
        name: String(celestialData.name || 'Celestial Body'),
        distanceStr: celestialData.distanceStr ? String(celestialData.distanceStr) : ''
      });
    }

    for (const arc of INITIAL_ARCS) {
      items.push({
        id: `vehicle-${arc.id}`,
        lat: arc.startLat,
        lng: arc.startLng,
        alt: arc.icon === '✈️' ? 0.05 : 0.01,
        size: 18,
        color: arc.color,
        isCelestial: false,
        isVehicle: true,
        icon: arc.icon
      });
    }

    return items;
  }, [hasValidCoords, latitude, longitude, celestialData]);

  const pathData = useMemo(() => {
    if (!hasValidCoords) return [];
    return [
      {
        coords: [
          [latitude, longitude, 0],
          [latitude, longitude, 1.5]
        ]
      }
    ];
  }, [hasValidCoords, latitude, longitude]);

  const getPolygonColor = useCallback(
    (d) => {
      if (colorMode === 'normal') return 'rgba(0, 0, 0, 0)';
      if (colorMode === 'random') return d.color || 'rgba(56, 189, 248, 0.4)';

      const pop = Number(d?.properties?.POP_EST) || 0;

      if (colorMode === 'population') {
        if (pop > 100000000) return 'rgba(239, 68, 68, 0.6)';
        if (pop > 50000000) return 'rgba(249, 115, 22, 0.6)';
        if (pop > 10000000) return 'rgba(234, 179, 8, 0.6)';
        return 'rgba(34, 197, 94, 0.6)';
      }
      if (colorMode === 'nature') {
        const s = Number(d.natureScore) || 60;
        return `rgba(${Math.floor(255 - s * 2.5)}, ${Math.floor(s * 2.5)}, 100, 0.6)`;
      }
      if (colorMode === 'culture') {
        const s = Number(d.cultureScore) || 60;
        return `rgba(${Math.floor(s * 2.5)}, 100, ${Math.floor(255 - s * 2.5)}, 0.6)`;
      }
      if (colorMode === 'temperature') {
        const t = ((Number(d.tempScore) || 0) + 20) / 60;
        return `rgba(${Math.floor(t * 255)}, 0, ${Math.floor((1 - t) * 255)}, 0.6)`;
      }
      if (colorMode === 'topography') {
        const topo = (Number(d.topoScore) || 0) / 5000;
        return `rgba(${Math.floor(100 + topo * 155)}, ${Math.floor(200 - topo * 100)}, ${Math.floor(topo * 150)}, 0.8)`;
      }
      return 'rgba(0,0,0,0)';
    },
    [colorMode]
  );

  // Build safe DOM nodes via createElement + textContent to prevent XSS
  const createMarkerElement = useCallback((d) => {
    const root = document.createElement('div');
    root.style.transform = 'translate(-50%, -50%)';

    if (d.isCelestial) {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer'
      });

      const orb = document.createElement('div');
      const safeSize = Number.isFinite(d.size) ? d.size : 45;
      const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(d.color) ? d.color : '#ffdd44';
      Object.assign(orb.style, {
        width: `${safeSize}px`,
        height: `${safeSize}px`,
        background: `radial-gradient(circle at 35% 35%, #ffffff, ${safeColor} 55%, #050510)`,
        borderRadius: '50%',
        boxShadow: `0 0 25px ${safeColor}, 0 0 50px ${safeColor}`,
        border: '2px solid #ffffff'
      });

      const label = document.createElement('div');
      Object.assign(label.style, {
        marginTop: '8px',
        background: 'rgba(5, 5, 20, 0.88)',
        border: `1.5px solid ${safeColor}`,
        color: '#ffffff',
        padding: '4px 10px',
        borderRadius: '12px',
        fontFamily: 'sans-serif',
        fontSize: '11px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 15px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)'
      });
      label.textContent = d.distanceStr ? `✨ ${d.name} • ${d.distanceStr}` : `✨ ${d.name}`;

      wrap.appendChild(orb);
      wrap.appendChild(label);
      root.appendChild(wrap);
    } else if (d.isVehicle) {
      const iconEl = document.createElement('div');
      const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(d.color) ? d.color : '#38bdf8';
      Object.assign(iconEl.style, {
        fontSize: '18px',
        filter: `drop-shadow(0 0 8px ${safeColor})`,
        pointerEvents: 'none'
      });
      iconEl.textContent = d.icon === '✈️' ? '✈️' : '🚢';
      root.appendChild(iconEl);
    } else {
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none'
      });

      const dot = document.createElement('div');
      Object.assign(dot.style, {
        width: '16px',
        height: '16px',
        background: '#6366f1',
        borderRadius: '50%',
        boxShadow: '0 0 15px #6366f1',
        border: '2px solid white'
      });

      const badge = document.createElement('div');
      Object.assign(badge.style, {
        marginTop: '4px',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '2px 6px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: '600',
        whiteSpace: 'nowrap'
      });
      badge.textContent = 'You Are Here';

      wrap.appendChild(dot);
      wrap.appendChild(badge);
      root.appendChild(wrap);
    }

    return root;
  }, []);

  const renderPolygonLabel = useCallback((feature) => {
    const d = feature?.properties || {};
    const admin = escapeHtml(d.ADMIN || 'Unknown');
    const iso = escapeHtml(d.ISO_A2 || 'N/A');
    const popM = Number.isFinite(Number(d.POP_EST)) ? (Number(d.POP_EST) / 1000000).toFixed(1) : '0.0';
    const temp = Number(feature?.tempScore) || 0;
    const topo = Number(feature?.topoScore) || 0;
    const nature = Number(feature?.natureScore) || 0;
    const culture = Number(feature?.cultureScore) || 0;

    return `
      <div style="background: rgba(15, 23, 42, 0.9); padding: 12px; border-radius: 8px; border: 1px solid #38bdf8; color: white; font-family: sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
        <b style="font-size: 16px; color: #38bdf8;">${admin} (${iso})</b><br />
        <div style="margin-top: 5px; font-size: 13px;">
          Population: <i>${popM}M</i><br />
          Temperature: <span style="color: #f87171;">${temp}°C</span><br />
          Elevation: <span style="color: #fbbf24;">~${topo}m</span><br />
          Nature Index: <span style="color: #4ade80;">${nature}/100</span><br />
          Culture Index: <span style="color: #f472b6;">${culture}/100</span>
        </div>
      </div>
    `;
  }, []);

  if (!hasValidCoords) return null;

  return (
    <div className="globe-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {/* Control Panel overlay for earth colors */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '14px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontFamily: 'sans-serif',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#38bdf8' }}>Earth Overlay</h3>
        <select
          aria-label="Earth Overlay Mode"
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            border: '1px solid #475569',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="normal">🌍 Normal Earth</option>
          <option value="random">🎨 Region Colors</option>
          <option value="population">👥 Population Density</option>
          <option value="nature">🌿 Nature Index</option>
          <option value="culture">🎭 Culture Index</option>
          <option value="temperature">🌡️ Avg Temperature</option>
          <option value="topography">⛰️ Topography</option>
        </select>
      </div>

      <Globe
        ref={handleGlobeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        polygonsData={countries.features}
        polygonAltitude={0.006}
        polygonCapColor={getPolygonColor}
        polygonSideColor={() => 'rgba(0, 50, 0, 0.15)'}
        polygonStrokeColor={() => '#111'}
        polygonLabel={renderPolygonLabel}
        polygonHoverColor={() => 'rgba(255, 255, 255, 0.5)'}
        arcsData={INITIAL_ARCS}
        arcStartLat={(d) => d.startLat}
        arcStartLng={(d) => d.startLng}
        arcEndLat={(d) => d.endLat}
        arcEndLng={(d) => d.endLng}
        arcColor={(d) => d.color}
        arcDashLength={0.4}
        arcDashGap={4}
        arcDashInitialGap={(d) => d.dashOffset}
        arcDashAnimateTime={2000}
        htmlElementsData={elementsData}
        htmlElement={createMarkerElement}
        htmlAltitude={(d) => d.alt}
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
