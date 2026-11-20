import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, LayerGroup, Marker, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../App.css';
import L from 'leaflet';

// Self-contained SVG marker data URL — works offline and avoids third-party CDN leaks
const PIN_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">' +
    '<path d="M14 1C6.82 1 1 6.82 1 14c0 9.75 13 24.5 13 24.5S27 23.75 27 14C27 6.82 21.18 1 14 1z" fill="#7b61ff" stroke="#ffffff" stroke-width="2"/>' +
    '<circle cx="14" cy="14" r="5" fill="#ffffff"/>' +
  '</svg>'
);

const OBSERVER_ICON = L.icon({
  iconUrl: `data:image/svg+xml;charset=utf-8,${PIN_SVG}`,
  iconSize: [28, 40],
  iconAnchor: [14, 39],
  popupAnchor: [0, -34]
});

// Keep Leaflet canvas/SVG tiles aligned when container resizes
const MapResizeHandler = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
};

// Handle map clicks (wrapping world longitudes into [-180, 180]) and smooth panning
const LocationMarker = ({ lat, lng, onSelect }) => {
  useMapEvents({
    click(e) {
      const wrapped = e.latlng.wrap();
      const clampedLat = Math.min(90, Math.max(-90, wrapped.lat));
      const clampedLng = Math.min(180, Math.max(-180, wrapped.lng));
      onSelect(clampedLat, clampedLng);
    }
  });

  const map = useMap();
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const center = map.getCenter();
    const moved = Math.abs(center.lat - lat) > 1e-4 || Math.abs(center.lng - lng) > 1e-4;
    if (moved) {
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.5 });
    }
  }, [lat, lng, map]);

  const markerPos = useMemo(() => [lat, lng], [lat, lng]);

  return <Marker position={markerPos} icon={OBSERVER_ICON} />;
};

const Map2D = ({ latitude, longitude, onLocationChange }) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <div
        className="map2d-wrapper"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)' }}
      >
        <p style={{ color: 'var(--text-muted)' }}>Waiting for location...</p>
      </div>
    );
  }

  return (
    <div className="map2d-wrapper">
      <MapContainer
        center={[latitude, longitude]}
        zoom={3}
        worldCopyJump
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <MapResizeHandler />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Dark Mode">
            <LayerGroup>
              <TileLayer
                attribution="&copy; Esri, HERE, Garmin, OpenStreetMap"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={16}
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={16}
                maxZoom={19}
              />
            </LayerGroup>
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark Streets (OSM)">
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="osm-dark-tiles"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Standard">
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution="&copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Topographical">
            <TileLayer
              attribution="&copy; OpenTopoMap"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <LocationMarker lat={latitude} lng={longitude} onSelect={onLocationChange} />
      </MapContainer>
    </div>
  );
};

export default Map2D;
