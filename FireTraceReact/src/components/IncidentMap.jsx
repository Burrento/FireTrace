import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

function IncidentMap({ latitude, longitude }) {
  const position = { lat: latitude, lng: longitude };

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <div style={{ width: '100%', height: '260px' }}>
        <Map
          mapId="firetrace-incident-map"
          defaultCenter={position}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
        >
          <AdvancedMarker position={position} />
        </Map>
      </div>
    </APIProvider>
  );
}

export default IncidentMap;
