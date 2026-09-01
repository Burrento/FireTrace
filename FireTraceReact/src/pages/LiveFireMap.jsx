import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import '../style.css';
import { apiFetch } from '../api';
import { isLoggedIn } from '../auth';
import { markerKey } from '../lib/ongoingFires';
import BottomNav from '../components/BottomNav';
import ThemeToggle from '../components/ThemeToggle';
import OngoingFireGlyph from '../components/OngoingFireGlyph';
import '../styles/fire-pulse.css';

/* The public live map: fires that BFP has verified and nobody has resolved.

   Everything on this screen is already filtered by the server -- there is no
   status filter here on purpose, because there is only one status worth
   showing a resident. A pin is here because the fire is still burning, and it
   leaves the moment personnel mark it Resolved.

   It polls rather than holding a socket: /ws/dashboard is personnel-only, and
   a fire's lifetime is measured in minutes, so a refresh every REFRESH_MS is
   current enough without giving civilians a channel into the operations feed. */
const CALAPAN_CENTER = { lat: 13.4117, lng: 121.1803 };
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'firetrace-dashboard-map';
const REFRESH_MS = 20000;

const FIRE_PIN = { background: '#d7192a', borderColor: '#7f0d18', glyphColor: '#ffffff' };

function elapsed(since) {
    const started = new Date(since).getTime();
    if (Number.isNaN(started)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - started) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function LiveFireMap() {
    const navigate = useNavigate();
    const [fires, setFires] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // A refresh that lands after the user has navigated away must not set
    // state on an unmounted screen.
    const liveRef = useRef(true);
    useEffect(() => () => { liveRef.current = false; }, []);

    const load = useCallback(() => {
        return apiFetch('/api/incidents/ongoing/')
            .then((data) => {
                if (!liveRef.current) return;
                setFires(Array.isArray(data?.fires) ? data.fires : []);
                setUpdatedAt(data?.as_of ? new Date(data.as_of) : new Date());
                setError('');
            })
            .catch(() => {
                if (!liveRef.current) return;
                // Keep the pins already on screen. A stale map with a warning
                // on it beats an empty one, which reads as "no fires".
                setError('Could not refresh — showing the last update.');
            })
            .finally(() => {
                if (liveRef.current) setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!isLoggedIn()) {
            navigate('/login');
            return undefined;
        }

        load();

        // A hidden tab is not being read, so it stops polling and catches up on
        // return rather than showing whatever it last fetched.
        let timer = setInterval(load, REFRESH_MS);
        const onVisibility = () => {
            clearInterval(timer);
            if (document.visibilityState === 'visible') {
                load();
                timer = setInterval(load, REFRESH_MS);
            }
        };

        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [navigate, load]);

    return (
        <div className="civilian-dashboard">
            <header className="civ-header">
                <div className="civ-header-left">
                    <Link to="/dashboard" className="civ-icon-btn" title="Back">
                        <i className="fa-solid fa-arrow-left"></i>
                    </Link>
                    <div className="civ-logo-container">
                        <i className="fa-solid fa-fire-flame-curved civ-logo-icon"></i>
                        <div className="civ-brand">
                            <span className="civ-brand-fire">FIRE</span>
                            <span className="civ-brand-trace">TRACE</span>
                        </div>
                    </div>
                </div>
                <div className="civ-header-right">
                    <ThemeToggle />
                </div>
            </header>

            <div className="civ-main-content">
                <section className="civ-live-head">
                    <div>
                        <h1 className="civ-section-title">Ongoing Fires</h1>
                        <p className="civ-live-sub">
                            Verified by BFP Calapan and not yet resolved.
                        </p>
                    </div>
                    <span className={fires.length ? 'civ-live-count is-active' : 'civ-live-count'}>
                        <span className="civ-live-dot" aria-hidden="true" />
                        {fires.length} active
                    </span>
                </section>

                {error && <p className="civ-live-warning">{error}</p>}

                {!apiKey ? (
                    <div className="civ-empty-state">
                        <div className="civ-empty-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                        <h3>Map unavailable</h3>
                        <p>No Google Maps key is configured for this build.</p>
                    </div>
                ) : (
                    <div className="civ-live-map">
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
                                {/* The ring is its own marker beneath the glyph so it
                                    stays centred on the coordinate. It has no timer:
                                    a fire pulses for as long as it is burning. */}
                                {fires.map((fire) => (
                                    <AdvancedMarker
                                        key={`pulse-${markerKey(fire)}`}
                                        position={{ lat: fire.latitude, lng: fire.longitude }}
                                        clickable={false}
                                        zIndex={0}
                                    >
                                        <span className="fire-pulse" aria-hidden="true" />
                                    </AdvancedMarker>
                                ))}

                                {fires.map((fire) => (
                                    <AdvancedMarker
                                        key={markerKey(fire)}
                                        position={{ lat: fire.latitude, lng: fire.longitude }}
                                        title={`${fire.incident_type_display} — ${fire.barangay}`}
                                        zIndex={1}
                                    >
                                        <OngoingFireGlyph
                                            alt={`Ongoing fire in ${fire.barangay}`}
                                            fallback={<Pin {...FIRE_PIN} scale={1.15} />}
                                        />
                                    </AdvancedMarker>
                                ))}
                            </Map>
                        </APIProvider>
                    </div>
                )}

                <section className="civ-live-list">
                    {loading && fires.length === 0 ? (
                        <div className="civ-loading-state">
                            <div className="civ-skeleton-card"></div>
                            <div className="civ-skeleton-card"></div>
                        </div>
                    ) : fires.length === 0 ? (
                        <div className="civ-empty-state">
                            <div className="civ-empty-icon"><i className="fa-solid fa-shield-heart"></i></div>
                            <h3>No ongoing fires</h3>
                            <p>Nothing is currently burning in Calapan.</p>
                            <p className="civ-empty-secondary">
                                This map updates on its own — leave it open during an emergency.
                            </p>
                        </div>
                    ) : (
                        fires.map((fire) => (
                            <article key={markerKey(fire)} className="civ-live-item">
                                <div className="civ-live-item-icon" aria-hidden="true">
                                    <i className="fa-solid fa-fire"></i>
                                </div>
                                <div className="civ-live-item-body">
                                    <h3>{fire.incident_type_display}</h3>
                                    <p className="civ-live-item-place">
                                        <i className="fa-solid fa-map-pin"></i> {fire.barangay}
                                    </p>
                                </div>
                                <div className="civ-live-item-meta">
                                    <span className={`civ-live-status status-${String(fire.workflow_status).replace(/_/g, '-')}`}>
                                        {fire.workflow_status_display}
                                    </span>
                                    <span className="civ-live-elapsed">{elapsed(fire.started_at)}</span>
                                </div>
                            </article>
                        ))
                    )}
                </section>

                <p className="civ-live-footnote">
                    {updatedAt
                        ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every ${REFRESH_MS / 1000}s`
                        : 'Loading…'}
                    <br />
                    Only fires confirmed by BFP personnel appear here. In an emergency,
                    call BFP Calapan — do not wait for a pin to appear.
                </p>
            </div>

            <BottomNav />
        </div>
    );
}

export default LiveFireMap;
