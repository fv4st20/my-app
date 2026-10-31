import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks and smooth panning
const LocationMarker = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { duration: 0.5 });
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

const Map2D = ({ latitude, longitude, onLocationChange }) => {
  if (!latitude || !longitude) {
    return (
      <div className="map2d-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel-bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Waiting for location...</p>
      </div>
    );
  }

  const handlePositionChange = (pos) => {
    if (onLocationChange) {
      onLocationChange(pos.lat, pos.lng);
    }
  };

  return (
    <div className="map2d-wrapper">
      <MapContainer 
        center={[latitude, longitude]} 
        zoom={3} 
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Topographical">
            <TileLayer
              attribution='&copy; OpenTopoMap'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark Mode">
            <TileLayer
              attribution='&copy; CartoDB'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        <LocationMarker position={{ lat: latitude, lng: longitude }} setPosition={handlePositionChange} />
      </MapContainer>
    </div>
  );
};

export default Map2D;
