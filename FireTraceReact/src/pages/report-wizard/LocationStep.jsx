import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../../style.css';
import { useReportDraft } from '../../context/useReportDraft';
import LocationPickerMap from '../../components/LocationPickerMap';
import BottomNav from '../../components/BottomNav';
import { CALAPAN_BARANGAYS } from '../../data/barangays';

function LocationStep() {
    const { draft, updateDraft } = useReportDraft();
    const hasPin = draft.latitude != null && draft.longitude != null;
    const canContinue = Boolean(draft.barangay) && hasPin && draft.location_confirmed;

    // Bumped only when we deliberately want the map to jump somewhere.
    // Placing or dragging a pin leaves the camera exactly where it is.
    const [recenterKey, setRecenterKey] = useState(0);

    // '', 'loading', 'found', 'not-found', 'error'
    const [lookup, setLookup] = useState('');

    /* The map calls back on every pin move, so this handler must keep a stable
       identity — refs let it read the latest draft without being recreated.
       Synced in an effect, since writing a ref during render is not allowed. */
    const draftRef = useRef(draft);
    const updateDraftRef = useRef(updateDraft);

    useEffect(() => {
        draftRef.current = draft;
        updateDraftRef.current = updateDraft;
    });

    const handleResolveLocation = useCallback(({ status, barangay, address }) => {
        setLookup(status);
        if (status !== 'found') return;

        const patch = { barangay };
        // Never clobber an address the user typed themselves.
        if (address && !draftRef.current.address) patch.address = address;
        updateDraftRef.current(patch);
    }, []);

    function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateDraft({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    // Recorded so the backend can grade how precise this fix
                    // was; a coarse fix is mapped less confidently than a pin.
                    location_source: 'device_gps',
                    gps_accuracy_m: position.coords.accuracy ?? null,
                });
                setRecenterKey((key) => key + 1);
            },
            () => {
                alert('Could not get your current location. Please pin it on the map instead.');
            }
        );
    }

    function handleClearPin() {
        updateDraft({ latitude: null, longitude: null, location_confirmed: false });
        setLookup('');
    }

    return (
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>2 of 4</p>
            </header>
            <button className="pinpointbtn" onClick={handleUseCurrentLocation} type="button">
                USE MY CURRENT LOCATION
            </button>

            <div className="map-container">
                <LocationPickerMap
                    latitude={draft.latitude}
                    longitude={draft.longitude}
                    onChange={(lat, lng) => updateDraft({
                        latitude: lat,
                        longitude: lng,
                        // Placing or dragging the pin supersedes any earlier
                        // GPS fix: the reporter has corrected it by hand.
                        location_source: 'map_pin',
                        gps_accuracy_m: null,
                    })}
                    onClear={handleClearPin}
                    onResolveLocation={handleResolveLocation}
                    recenterKey={recenterKey}
                />
            </div>

            <p className="barangay-text">Barangay</p>
            <div>
                <select
                    id="incident-select"
                    name="incident-select"
                    value={draft.barangay}
                    onChange={(e) => updateDraft({ barangay: e.target.value })}
                >
                    <option value="">Select Barangay</option>
                    {CALAPAN_BARANGAYS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                {hasPin && lookup === 'loading' && (
                    <p className="barangay-hint">Detecting barangay from the pin...</p>
                )}
                {hasPin && lookup === 'found' && (
                    <p className="barangay-hint barangay-hint-ok">
                        Auto-detected from the map pin. Change it above if this is wrong.
                    </p>
                )}
                {hasPin && lookup === 'not-found' && (
                    <p className="barangay-hint barangay-hint-warn">
                        Could not match a Calapan barangay to this pin. Please select it manually.
                    </p>
                )}
                {hasPin && lookup === 'error' && (
                    <p className="barangay-hint barangay-hint-warn">
                        Barangay lookup failed. Please select it manually.
                    </p>
                )}
            </div>

            <p className="address-text">Address / Landmark</p>
            <div>
                <textarea className="addresstxt"
                    id="description"
                    name="description"
                    placeholder="Enter Address..."
                    value={draft.address}
                    onChange={(e) => updateDraft({ address: e.target.value })}>
                </textarea>
            </div>
            <p className="latnlng">
                Lat: {hasPin ? draft.latitude.toFixed(6) : '—'} &nbsp;&nbsp;&nbsp;&nbsp;
                Lng: {hasPin ? draft.longitude.toFixed(6) : '—'}
            </p>
            <label className="checkbox-label">
                <input
                    type="checkbox"
                    checked={draft.location_confirmed}
                    disabled={!hasPin}
                    onChange={(e) => updateDraft({ location_confirmed: e.target.checked })}
                />
                <span className="checkbox-txt">I confirm this pin identifies the reported location.</span>
            </label>

            <div className="backcontinue2-container">
            <button className="backbtn2"><Link to="/report">Back</Link></button>
            <button className="continuebtn2" disabled={!canContinue}>
                {canContinue ? <Link to="/continuethird">Continue</Link> : 'Continue'}
            </button>
            </div>
            <BottomNav active="report" />
        </center>
    );
}

export default LocationStep;
