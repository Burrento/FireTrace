import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

function IncidentMap({ latitude, longitude }) {
  const position = { lat: latitude, lng: longitude };

  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <div className="map-frame">
        <Map
          mapId={MAP_ID}
          defaultCenter={position}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          <AdvancedMarker position={position} />
        </Map>
      </div>
    </APIProvider>
  );
}

export default IncidentMap;
