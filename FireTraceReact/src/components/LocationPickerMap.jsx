import { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

const DEFAULT_CENTER = { lat: 13.4117, lng: 121.1803 }; // Calapan City

/**
 * Pans the map imperatively when `recenterKey` changes.
 *
 * The <Map> itself is left uncontrolled so React never fights the user's
 * dragging — recentring only happens when the parent explicitly asks for
 * it (e.g. "use my current location"), not every time the pin moves.
 */
function MapRecenter({ position, recenterKey }) {
  const map = useMap();
  const lastKey = useRef(recenterKey);

  useEffect(() => {
    if (!map || !position) return;
    if (lastKey.current === recenterKey) return;
    lastKey.current = recenterKey;
    map.panTo(position);
  }, [map, position, recenterKey]);

  return null;
}

function LocationPickerMap({ latitude, longitude, onChange, onClear, recenterKey = 0 }) {
  const position = latitude != null && longitude != null
    ? { lat: latitude, lng: longitude }
    : null;

  function handleMapClick(event) {
    const latLng = event.detail.latLng;
    if (!latLng) return;
    onChange(latLng.lat, latLng.lng);
  }

  function handleMarkerDragEnd(event) {
    const latLng = event.latLng;
    if (!latLng) return;
    onChange(latLng.lat(), latLng.lng());
  }

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <div className="map-frame">
        <Map
          mapId="firetrace-location-picker"
          defaultCenter={position ?? DEFAULT_CENTER}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={handleMapClick}
        >
          {position && (
            <AdvancedMarker
              position={position}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
          <MapRecenter position={position} recenterKey={recenterKey} />
        </Map>
      </div>

      {position && onClear && (
        <button type="button" className="removepinbtn" onClick={onClear}>
          REMOVE PIN
        </button>
      )}
    </APIProvider>
  );
}

export default LocationPickerMap;
