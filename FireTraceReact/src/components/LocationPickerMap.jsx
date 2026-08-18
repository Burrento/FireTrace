import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const DEFAULT_CENTER = { lat: 13.4117, lng: 121.1803 }; // Calapan City

function LocationPickerMap({ latitude, longitude, onChange }) {
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
      <div style={{ width: '100%', height: '260px' }}>
        <Map
          mapId="firetrace-location-picker"
          defaultCenter={position ?? DEFAULT_CENTER}
          center={position ?? undefined}
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
        </Map>
      </div>
    </APIProvider>
  );
}

export default LocationPickerMap;
