import { useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

const DEFAULT_CENTER = { lat: 13.4117, lng: 121.1803 }; // Calapan City

// Advanced markers (the draggable ones) only work on a map that has a map ID.
// DEMO_MAP_ID is Google's public testing ID; set VITE_GOOGLE_MAPS_MAP_ID to a
// real one from the Cloud console for production / custom map styling.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

// Keeps the pin reachable without hijacking the map: only pans when the pin has
// ended up outside the visible area (e.g. after "use my current location").
// Panning on every change would fight the user while they pan or drag.
function RecenterOnPin({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (!map || lat == null || lng == null) return;
    const bounds = map.getBounds();
    if (bounds && bounds.contains({ lat, lng })) return;
    map.panTo({ lat, lng });
  }, [map, lat, lng]);

  return null;
}

function LocationPickerMap({ latitude, longitude, onChange, onClear }) {
  const hasPin = latitude != null && longitude != null;
  const position = hasPin ? { lat: latitude, lng: longitude } : null;

  // Tap anywhere on the map to drop (or move) the pin.
  function handleMapClick(event) {
    const latLng = event.detail.latLng;
    if (!latLng) return;
    onChange(latLng.lat, latLng.lng);
  }

  // Fired once when the pin is released; the marker follows the finger natively
  // while dragging, so there's no need to update state on every frame.
  function handleMarkerDragEnd(event) {
    const latLng = event.latLng;
    if (!latLng) return;
    onChange(latLng.lat(), latLng.lng());
  }

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <div className="map-frame">
        <Map
          mapId={MAP_ID}
          defaultCenter={position ?? DEFAULT_CENTER}
          defaultZoom={hasPin ? 17 : 14}
          gestureHandling="greedy"
          clickableIcons={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          onClick={handleMapClick}
        >
          {position && (
            <AdvancedMarker
              position={position}
              draggable
              onDragEnd={handleMarkerDragEnd}
              title="Drag to adjust the exact location"
            />
          )}
          <RecenterOnPin lat={latitude} lng={longitude} />
        </Map>

        {hasPin && (
          <button type="button" className="map-clear-btn" onClick={onClear}>
            Remove pin
          </button>
        )}
      </div>
      <p className="map-hint">
        {hasPin
          ? 'Drag the pin to fine-tune it, or tap elsewhere to move it.'
          : 'Tap the map to place a pin on the fire location.'}
      </p>
    </APIProvider>
  );
}

export default LocationPickerMap;
