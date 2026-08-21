import { useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { matchBarangay } from '../data/barangays';

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
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
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
          <BarangayResolver
            latitude={latitude}
            longitude={longitude}
            onResolve={onResolveLocation}
          />
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
