import { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { matchBarangay } from '../data/barangays';

const DEFAULT_CENTER = { lat: 13.4117, lng: 121.1803 }; // Calapan City

// Advanced markers (the draggable ones) only work on a map that has a map ID.
// DEMO_MAP_ID is Google's public testing ID; set VITE_GOOGLE_MAPS_MAP_ID to a
// real one from the Cloud console for production / custom map styling.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

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

/**
 * Reverse-geocodes the pin and reports the barangay back to the parent.
 *
 * Lives inside <APIProvider> because that is the only place the Maps SDK is
 * available; the parent form sits outside it.
 */
function BarangayResolver({ latitude, longitude, onResolve }) {
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useRef(null);
  const lastLookup = useRef(null);

  useEffect(() => {
    if (!geocodingLib || !onResolve) return undefined;
    if (latitude == null || longitude == null) {
      lastLookup.current = null;
      return undefined;
    }

    // Small pin nudges resolve to the same place, so avoid repeat lookups
    // (each one is a billable geocoding request).
    const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
    if (lastLookup.current === key) return undefined;
    lastLookup.current = key;

    if (!geocoder.current) geocoder.current = new geocodingLib.Geocoder();

    let cancelled = false;
    onResolve({ status: 'loading' });

    geocoder.current
      .geocode({ location: { lat: latitude, lng: longitude } })
      .then((response) => {
        if (cancelled) return;
        const results = response.results || [];

        // The barangay can land in sublocality, neighborhood or a plain
        // political component depending on the area, so test them all.
        const names = results.flatMap((result) =>
          (result.address_components || []).map((component) => component.long_name),
        );

        const barangay = matchBarangay(names);
        onResolve({
          status: barangay ? 'found' : 'not-found',
          barangay,
          address: results[0]?.formatted_address || '',
        });
      })
      .catch(() => {
        if (cancelled) return;
        lastLookup.current = null; // let a retry happen
        onResolve({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [geocodingLib, latitude, longitude, onResolve]);

  return null;
}

function LocationPickerMap({ latitude, longitude, onChange, onClear, onResolveLocation, recenterKey = 0 }) {
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
          disableDefaultUI={false}
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
          <MapRecenter position={position} recenterKey={recenterKey} />
          <BarangayResolver
            latitude={latitude}
            longitude={longitude}
            onResolve={onResolveLocation}
          />
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
