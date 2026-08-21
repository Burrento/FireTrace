import { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin } from '@vis.gl/react-google-maps';

/* The live operations map.

   Two marker families, deliberately distinct:
     - canonical incidents (verified by personnel) — solid red, flame glyph
     - civilian reports (unverified) — hollow amber, and violet once flagged as
       a possible duplicate

   Only High and Medium geocoding confidence records reach this component; the
   backend withholds Low rather than drawing a point the data cannot support,
   and reports the count so the omission is visible rather than silent. */

const CALAPAN_CENTER = { lat: 13.4117, lng: 121.1803 };
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'firetrace-dashboard-map';

const INCIDENT_PIN = { background: '#d7192a', borderColor: '#7f0d18', glyphColor: '#ffffff' };
const REPORT_PIN = { background: '#f7b32b', borderColor: '#a9760a', glyphColor: '#5a3d00' };
const DUPLICATE_PIN = { background: '#8b5cf6', borderColor: '#5b21b6', glyphColor: '#ffffff' };

function markerStyle(marker) {
  if (marker.kind === 'incident') return INCIDENT_PIN;
  if (marker.duplicate_status === 'possible_duplicate') return DUPLICATE_PIN;
  return REPORT_PIN;
}

function MapLegend({ withheld }) {
  return (
    <div className="bfp-map-legend">
      <span className="bfp-legend-item">
        <span className="bfp-legend-dot" style={{ background: INCIDENT_PIN.background }} />
        Verified incident
      </span>
      <span className="bfp-legend-item">
        <span className="bfp-legend-dot" style={{ background: REPORT_PIN.background }} />
        Unverified report
      </span>
      <span className="bfp-legend-item">
        <span className="bfp-legend-dot" style={{ background: DUPLICATE_PIN.background }} />
        Possible duplicate
      </span>
      {withheld > 0 && (
        <span className="bfp-legend-note" title="Low geocoding confidence records are not plotted">
          <i className="fa-solid fa-eye-slash" /> {withheld} withheld (low confidence)
        </span>
      )}
    </div>
  );
}

function MarkerDetails({ marker, onClose }) {
  const isIncident = marker.kind === 'incident';

  return (
    <InfoWindow
      position={{ lat: marker.latitude, lng: marker.longitude }}
      onCloseClick={onClose}
      pixelOffset={[0, -36]}
    >
      <div className="bfp-infowindow">
        <div className="bfp-iw-head">
          <strong>{marker.reference_number}</strong>
          <span className={`bfp-iw-kind ${isIncident ? 'is-incident' : 'is-report'}`}>
            {isIncident ? 'Verified incident' : 'Unverified report'}
          </span>
        </div>
        <p className="bfp-iw-line">{marker.incident_type_display} · {marker.barangay}</p>
        <p className="bfp-iw-line">
          Status: {String(marker.workflow_status).replace(/_/g, ' ')}
        </p>
        {isIncident ? (
          <p className="bfp-iw-line">
            {marker.source_report_count} source report
            {marker.source_report_count === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="bfp-iw-line">
            Confidence: {marker.geocoding_confidence}
            {marker.has_photo ? ' · photo attached' : ''}
          </p>
        )}
        <p className="bfp-iw-time">{new Date(marker.created_at).toLocaleString()}</p>
      </div>
    </InfoWindow>
  );
}

function DashboardMap({ data, loading, error }) {
  const [selected, setSelected] = useState(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const reports = data?.reports ?? [];
  const incidents = data?.incidents ?? [];
  const markers = [...incidents, ...reports];

  if (!apiKey) {
    return (
      <section className="bfp-panel bfp-map-panel">
        <header className="bfp-panel-head">
          <h2 className="bfp-panel-title">Live Incident Map</h2>
        </header>
        <div className="bfp-map-fallback">
          <i className="fa-solid fa-triangle-exclamation" />
          <p>No Google Maps API key configured.</p>
          <p className="bfp-map-fallback-hint">
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>FireTraceReact/.env</code> and restart Vite.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bfp-panel bfp-map-panel">
      <header className="bfp-panel-head">
        <div>
          <h2 className="bfp-panel-title">Live Incident Map</h2>
          <p className="bfp-panel-sub">
            {incidents.length} verified · {reports.length} unverified plotted
          </p>
        </div>
        {loading && !data && <span className="bfp-panel-flag">Loading…</span>}
      </header>

      {error && <p className="bfp-inline-error">{error}</p>}

      <div className="bfp-map-canvas">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId={MAP_ID}
            defaultCenter={CALAPAN_CENTER}
            defaultZoom={13}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl
          >
            {markers.map((marker) => (
              <AdvancedMarker
                key={`${marker.kind}-${marker.id}`}
                position={{ lat: marker.latitude, lng: marker.longitude }}
                title={`${marker.reference_number} — ${marker.barangay}`}
                onClick={() => setSelected(marker)}
                zIndex={marker.kind === 'incident' ? 2 : 1}
              >
                <Pin
                  {...markerStyle(marker)}
                  scale={marker.kind === 'incident' ? 1.15 : 0.9}
                />
              </AdvancedMarker>
            ))}

            {selected && (
              <MarkerDetails marker={selected} onClose={() => setSelected(null)} />
            )}
          </Map>
        </APIProvider>
      </div>

      <MapLegend withheld={data?.withheld_low_confidence ?? 0} />
    </section>
  );
}

export default DashboardMap;
