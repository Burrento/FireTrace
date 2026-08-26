import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin, useMap } from '@vis.gl/react-google-maps';

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

/* A civilian report pulses on the map while it is this recent. The window is
   comfortably wider than the 15s dashboard poll, so a report is always still
   pulsing by the time the first refresh that carries it reaches the screen. */
const PULSE_WINDOW_MS = 90000;
const PULSE_RECHECK_MS = 5000;

function markerStyle(marker) {
  if (marker.kind === 'incident') return INCIDENT_PIN;
  if (marker.duplicate_status === 'possible_duplicate') return DUPLICATE_PIN;
  return REPORT_PIN;
}

/* The ids of the civilian reports that should be pulsing right now.

   Freshness is read off `created_at` rather than off a diff between polls, so
   it survives a remount, a background tab and the switch from polling to
   Channels without changing. `now` only advances while something is pulsing;
   the rest of the time it stays frozen, which can only make an arriving report
   look newer than it is — never older. */
function useFreshReports(reports) {
  const [now, setNow] = useState(() => Date.now());

  const fresh = new Set();
  for (const report of reports) {
    const age = now - new Date(report.created_at).getTime();
    // A negative age is clock skew between server and browser; still fresh.
    if (!Number.isNaN(age) && age < PULSE_WINDOW_MS) fresh.add(report.id);
  }

  const pulsing = fresh.size > 0;
  useEffect(() => {
    if (!pulsing) return undefined;
    const timer = setInterval(() => setNow(Date.now()), PULSE_RECHECK_MS);
    return () => clearInterval(timer);
  }, [pulsing]);

  return fresh;
}

/* How close the camera goes when a report lands. Neighbourhood level: close
   enough to see which street, wide enough to keep the surrounding barangay and
   any nearby incident in frame. */
const FOCUS_ZOOM = 15;

/* Moves the camera to a report the moment it arrives.

   Only ever reacts to an id it has not focused before, so the operator can pan
   and zoom freely afterwards without the map dragging itself back. It also
   never zooms *out*: if they are already closer in than FOCUS_ZOOM, that was a
   deliberate choice and the camera only pans. */
function FocusOnNewReport({ report }) {
  const map = useMap();
  const focusedRef = useRef(null);

  useEffect(() => {
    if (!map || !report) return;
    if (focusedRef.current === report.id) return;

    focusedRef.current = report.id;
    map.panTo({ lat: report.latitude, lng: report.longitude });
    if ((map.getZoom() ?? 0) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM);
  }, [map, report]);

  return null;
}

function MapLegend({ withheld, pulsing }) {
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
      {pulsing > 0 && (
        <span className="bfp-legend-item">
          <span className="bfp-legend-dot bfp-legend-dot-pulse" />
          {pulsing} just reported
        </span>
      )}
      {withheld > 0 && (
        <span className="bfp-legend-note" title="Low geocoding confidence records are not plotted">
          <i className="fa-solid fa-eye-slash" /> {withheld} withheld (low confidence)
        </span>
      )}
    </div>
  );
}

/* Closes the details popup on any press that is not inside it.

   The Map's own onClick is not enough: an open InfoWindow lays a wrapper over
   the map that is much larger than the visible bubble, and a press landing on
   that wrapper never reaches the map at all -- which is exactly the "clicked
   away and it stayed open" case. Listening on the map container catches both.

   `pointerdown` rather than `click` so this runs *before* a marker's own click
   handler: pressing a different pin closes the old popup and then opens the new
   one, instead of the two fighting over the same state. */
function DismissDetailsOnOutsidePress({ onDismiss }) {
  const map = useMap();

  useEffect(() => {
    const container = map?.getDiv();
    if (!container) return undefined;

    const onPointerDown = (event) => {
      if (!event.target.closest?.('.gm-style-iw')) onDismiss();
    };

    container.addEventListener('pointerdown', onPointerDown);
    return () => container.removeEventListener('pointerdown', onPointerDown);
  }, [map, onDismiss]);

  return null;
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
            {marker.has_photo && !marker.photo_url ? ' · photo attached' : ''}
          </p>
        )}
        {/* The reporter's photograph, when there is one. Shown rather than
            described: an operator deciding whether to dispatch wants to see
            the fire, and "Photo Attached" made them open the record to do it.
            The URL is SAS-signed and expires, so a popup left open overnight
            can find it stale -- say so instead of showing a broken image. */}
        {marker.photo_url && (
          <a
            className="bfp-iw-photo"
            href={marker.photo_url}
            target="_blank"
            rel="noreferrer"
            title="Open full size"
          >
            <img
              src={marker.photo_url}
              alt={`Reported at ${marker.barangay}`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.replaceWith(
                  Object.assign(document.createElement('span'), {
                    className: 'bfp-iw-photo-failed',
                    textContent: 'Photo unavailable — refresh to reload',
                  }),
                );
              }}
            />
          </a>
        )}
        <p className="bfp-iw-time">{new Date(marker.created_at).toLocaleString()}</p>
      </div>
    </InfoWindow>
  );
}

function DashboardMap({
  data,
  loading,
  error,
  title = 'Live Incident Map',
  hours,
  onHoursChange,
  focusOnNew = true,
}) {
  const [selected, setSelected] = useState(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const reports = data?.reports ?? [];
  const incidents = data?.incidents ?? [];
  const markers = [...incidents, ...reports];
  const fresh = useFreshReports(reports);

  // Escape closes the details too, which is what an operator reaches for
  // before hunting the small X. Registered only while something is open.
  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  // The newest still-pulsing report drives the camera. `reports` arrives
  // newest-first from the server, so the first match is the latest.
  const newestFresh = focusOnNew ? reports.find((r) => fresh.has(r.id)) : undefined;

  if (!apiKey) {
    return (
      <section className="bfp-panel bfp-map-panel">
        <header className="bfp-panel-head">
          <h2 className="bfp-panel-title">{title}</h2>
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
          <h2 className="bfp-panel-title">{title}</h2>
          <p className="bfp-panel-sub">
            {incidents.length} verified · {reports.length} unverified plotted
            {/* Say which slice this is. A map that quietly hides older pins is
                worse than no filter at all -- the operator has no way to tell
                an empty map from a filtered one. */}
            {data?.recent_hours ? ` · last ${data.recent_hours}h + ongoing` : ''}
            {data?.scope === 'all' ? ' · all time' : ''}
          </p>
        </div>
        <div className="bfp-map-head-right">
          {/* Only the live map offers this; the All Reports map is all-time by
              definition and passes no handler. */}
          {onHoursChange && (
            <div className="bfp-window-switch" role="group" aria-label="Map time window">
              {(data?.recent_hours_choices ?? [1, 6, 24]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={choice === hours ? 'is-active' : ''}
                  onClick={() => onHoursChange(choice)}
                >
                  {choice}h
                </button>
              ))}
            </div>
          )}
          {loading && !data && <span className="bfp-panel-flag">Loading…</span>}
        </div>
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
            {selected && (
              <DismissDetailsOnOutsidePress onDismiss={() => setSelected(null)} />
            )}

            {newestFresh && <FocusOnNewReport report={newestFresh} />}

            {/* Drawn as their own markers under the pins so the ring stays
                centred on the coordinate while the pin keeps its tip anchor. */}
            {reports
              .filter((report) => fresh.has(report.id))
              .map((report) => (
                <AdvancedMarker
                  key={`pulse-${report.id}`}
                  position={{ lat: report.latitude, lng: report.longitude }}
                  clickable={false}
                  zIndex={0}
                >
                  <span className="bfp-map-pulse" aria-hidden="true" />
                </AdvancedMarker>
              ))}

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

      <MapLegend withheld={data?.withheld_low_confidence ?? 0} pulsing={fresh.size} />
    </section>
  );
}

export default DashboardMap;
