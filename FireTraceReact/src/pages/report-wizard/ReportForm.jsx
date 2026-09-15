import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';
import { isLoggedIn } from '../../auth';
import { useReportDraft } from '../../context/useReportDraft';
import LocationPickerMap from '../../components/LocationPickerMap';
import CivHeader from '../../components/CivHeader';
import EmergencyNotice from '../../components/EmergencyNotice';

/* The whole report on one page, filed by one button press.

   Submitting from a press rather than on arrival at the receipt means the POST
   happens exactly once: a refresh cannot file a second copy of the same fire. */

/* Phone cameras produce 3-8 MB files and the reporter is often on mobile data,
   so the photo is shrunk on the device before it is attached: 1600px on the
   long edge at JPEG 0.8 is a few hundred KB and still sharp enough for an
   operator to judge a fire. The server refuses anything over 5 MB. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_EDGE = 1600;

async function compressPhoto(file) {
    try {
        // from-image applies the EXIF rotation, so a portrait shot stays upright.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
    } catch {
        // A format this browser cannot decode (some HEIC) goes up as picked;
        // the server decides whether it is acceptable.
        return file;
    }
}

/* The photo never travels in the JSON draft: it is a File, it is large, and it
   is optional. When one is attached the whole report goes as multipart
   instead, which is why apiFetch has to leave Content-Type alone. */
function buildFormData(draft, photo) {
    const form = new FormData();
    for (const [key, value] of Object.entries(draft)) {
        // Skipped rather than sent as the string "null", which every typed
        // field on the serializer would reject.
        if (value === null || value === undefined) continue;
        form.append(key, typeof value === 'boolean' ? String(value) : value);
    }
    form.append('photo', photo);
    return form;
}

function ReportForm() {
    const navigate = useNavigate();
    const { draft, updateDraft, resetDraft } = useReportDraft();
    const hasPin = draft.latitude != null && draft.longitude != null;
    // Description is deliberately not required: a reporter in a rush files
    // with a type and a location and nothing else.
    const canSubmit = Boolean(draft.incident_type) && hasPin && draft.location_confirmed;

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [preparingPhoto, setPreparingPhoto] = useState(false);
    // A failed submission, as opposed to a photo or form problem: the reporter
    // must not be left thinking the station has it.
    const [notSent, setNotSent] = useState(false);
    const cameraInput = useRef(null);
    const galleryInput = useRef(null);

    // Bumped only when we deliberately want the map to jump somewhere.
    // Placing or dragging a pin leaves the camera exactly where it is.
    const [recenterKey, setRecenterKey] = useState(0);
    // '', 'locating', 'denied'
    const [gps, setGps] = useState('');
    // '', 'loading', 'found', 'not-found', 'error'
    const [lookup, setLookup] = useState('');

    const now = useMemo(() => new Date(), []);
    const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    /* Derived rather than stored, so the URL always matches the current file.
       Object URLs are held by the document until revoked, so a reporter who
       retakes the shot a few times would otherwise leak every attempt. */
    const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo]);

    useEffect(() => {
        if (!previewUrl) return undefined;
        return () => URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    /* The map calls back on every pin move, so this handler must keep a stable
       identity — refs let it read the latest draft without being recreated.
       Synced in an effect, since writing a ref during render is not allowed. */
    const draftRef = useRef(draft);
    const updateDraftRef = useRef(updateDraft);

    useEffect(() => {
        draftRef.current = draft;
        updateDraftRef.current = updateDraft;
    });

    // The last address the geocoder wrote, so a moved pin can replace it while
    // an address the reporter typed is left alone.
    const autoAddress = useRef('');

    // The barangay is never typed or picked: it is whatever Google's reverse
    // geocode of the pin matches in the Calapan list, cleared when it does not.
    const handleResolveLocation = useCallback(({ status, barangay, address }) => {
        setLookup(status);
        if (status === 'loading' || status === 'error') return;

        const patch = { barangay: barangay || '' };
        const current = draftRef.current.address;
        // `current === address` covers a refresh, where the ref starts empty but
        // the restored draft still holds the geocoded address.
        if (address && (!current || current === autoAddress.current || current === address)) {
            patch.address = address;
            autoAddress.current = address;
        }
        updateDraftRef.current(patch);
    }, []);

    const locateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setGps('denied');
            return;
        }
        setGps('locating');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setGps('');
                updateDraftRef.current({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    // Recorded so the backend can grade how precise this fix
                    // was; a coarse fix is mapped less confidently than a pin.
                    location_source: 'device_gps',
                    gps_accuracy_m: position.coords.accuracy ?? null,
                });
                setRecenterKey((key) => key + 1);
            },
            () => setGps('denied'),
            { enableHighAccuracy: true, timeout: 15000 },
        );
    }, []);

    /* Located on arrival rather than on a button press. Skipped when the draft
       already holds a pin, so a refresh does not throw away one the reporter
       placed by hand. */
    useEffect(() => {
        if (draftRef.current.latitude == null) locateMe();
    }, [locateMe]);

    // Removing the pin also drops the confirmation — there is no longer a
    // location for the user to be confirming.
    function handleClearPin() {
        updateDraft({ latitude: null, longitude: null, barangay: '', location_confirmed: false });
        setLookup('');
    }

    async function handleFileChange(event) {
        const file = event.target.files?.[0];
        // Reset immediately so picking the same file twice still fires change,
        // which is what happens when someone retakes a photo they just removed.
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('That file is not an image. Choose a photo instead.');
            return;
        }
        setError('');
        setPreparingPhoto(true);
        const compressed = await compressPhoto(file);
        setPreparingPhoto(false);
        if (compressed.size > MAX_PHOTO_BYTES) {
            const mb = (compressed.size / 1024 / 1024).toFixed(1);
            setError(`That photo is ${mb} MB. Please use one under 5 MB.`);
            return;
        }
        setPhoto(compressed);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (submitting || !canSubmit) return;

        if (!isLoggedIn()) {
            navigate('/login');
            return;
        }

        setError('');
        setNotSent(false);
        setSubmitting(true);
        try {
            const incident = await apiFetch('/incidents/', {
                method: 'POST',
                body: photo ? buildFormData(draft, photo) : JSON.stringify(draft),
            });
            resetDraft();
            // `replace` so Back does not return to a finished form.
            navigate('/continue4', { state: { incident }, replace: true });
        } catch (err) {
            setError(err.message || 'Failed to submit report.');
            setNotSent(true);
            setSubmitting(false);
        }
    }

    return (
        <center>
            <CivHeader title="Report a fire" subtitle="Fill in what you can, then submit" back="/dashboard" />

            <form onSubmit={handleSubmit}>
                <EmergencyNotice />
                <p className="incident-text">Incident Type:</p>
                <div>
                    <select
                        id="incident-select"
                        name="incident_type"
                        value={draft.incident_type}
                        onChange={(e) => updateDraft({ incident_type: e.target.value })}
                        required
                    >
                        <option value="">Select Incident Type</option>
                        <option value="fire">Residential Fire</option>
                        <option value="vehicle">Vehicle Fire</option>
                        <option value="electrical">Electrical Fire</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <p className="description-text">Description (Optional)</p>
                <div>
                    <textarea
                        id="description"
                        name="description"
                        placeholder="Enter incident description..."
                        value={draft.description}
                        onChange={(e) => updateDraft({ description: e.target.value })}
                    ></textarea>
                </div>

                <p className="description-text">Date & Time</p>
                <div className="date-time-container">
                    <input type="text" id="date" value={date} readOnly />
                    <input type="text" id="time" value={time} readOnly />
                </div>

                <button className="pinpointbtn" onClick={locateMe} type="button" disabled={gps === 'locating'}>
                    {gps === 'locating' ? 'LOCATING YOU…' : 'USE MY CURRENT LOCATION'}
                </button>
                {gps === 'denied' && (
                    <p className="barangay-hint barangay-hint-warn">
                        Could not get your current location. Please pin it on the map instead.
                    </p>
                )}

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
                {/* Drawn like the address box so it reads as a value, not a footnote. */}
                <p
                    className={`barangay-value${hasPin && lookup !== 'loading' && draft.barangay ? '' : ' barangay-value-empty'}`}
                    aria-live="polite"
                >
                    {!hasPin && 'Waiting for the pin…'}
                    {hasPin && lookup === 'loading' && 'Detecting barangay…'}
                    {hasPin && lookup !== 'loading' && (draft.barangay
                        || 'Not detected — BFP will use the pin and address')}
                </p>

                <p className="address-text">Address / Landmark</p>
                <div>
                    <textarea
                        className="addresstxt"
                        id="address"
                        name="address"
                        placeholder="Enter Address..."
                        value={draft.address}
                        onChange={(e) => updateDraft({ address: e.target.value })}
                    ></textarea>
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

                <p className="addphoto">Add Supporting Photograph (Optional)</p>
                <div className="photo-warning">
                    <span className="photo-warning-icon">⚠️</span>
                    <p>Do not approach the fire or place yourself in danger to capture a photograph.</p>
                </div>

                {/* Two inputs rather than one: `capture` asks the phone for the
                    camera directly, and a gallery pick must not carry it. */}
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleFileChange} hidden />
                <input ref={galleryInput} type="file" accept="image/*" onChange={handleFileChange} hidden />

                {previewUrl ? (
                    <div className="photo-preview">
                        <img src={previewUrl} alt="Attached photograph of the incident" />
                        <p className="photo-preview-name">
                            {photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                        <button type="button" className="photo-remove" onClick={() => setPhoto(null)} disabled={submitting}>
                            REMOVE PHOTO
                        </button>
                    </div>
                ) : (
                    <>
                        <button type="button" className="takephoto" onClick={() => cameraInput.current?.click()} disabled={submitting}>
                            TAKE SAFE PHOTO
                        </button>
                        <br />
                        <button type="button" className="selectphoto" onClick={() => galleryInput.current?.click()} disabled={submitting}>
                            SELECT FROM GALLERY
                        </button>
                    </>
                )}

                {error && <p className="auth-error">{error}</p>}
                {notSent && <EmergencyNotice>Your report was not sent.</EmergencyNotice>}
                {!canSubmit && (
                    <p className="barangay-hint">
                        To submit: choose the incident type, pin the location, and tick the confirmation.
                    </p>
                )}

                <div className="backcontinue-container">
                    <button type="submit" className="continuebtn" disabled={submitting || preparingPhoto || !canSubmit}>
                        {submitting ? 'Submitting…' : preparingPhoto ? 'Preparing photo…' : 'Submit Report'}
                    </button>
                </div>
            </form>
        </center>
    );
}

export default ReportForm;
