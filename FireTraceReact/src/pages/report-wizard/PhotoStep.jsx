import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';
import { isLoggedIn } from '../../auth';
import { useReportDraft } from '../../context/useReportDraft';
import CivHeader from '../../components/CivHeader';

/* Step 3 of 3 — the last step, and the one that actually files the report.

   Submitting from a button press rather than on arrival at a confirmation
   screen means the POST happens exactly once, on a deliberate action: a
   refresh or a back-then-forward can no longer file a second copy of the same
   fire, which the duplicate rule would then have to flag. */

/* Phone cameras produce 3-8 MB files and the reporter is often on mobile data,
   so refuse the outliers here with a clear message rather than letting a slow
   upload fail somewhere less legible. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

function PhotoStep() {
    const navigate = useNavigate();
    const { draft, resetDraft } = useReportDraft();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [photo, setPhoto] = useState(null);
    const cameraInput = useRef(null);
    const galleryInput = useRef(null);

    /* Derived rather than stored, so the URL always matches the current file.
       Object URLs are held by the document until revoked, so a reporter who
       retakes the shot a few times would otherwise leak every attempt. */
    const previewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo]);

    useEffect(() => {
        if (!previewUrl) return undefined;
        return () => URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    /* Each step gates its own Continue, so a draft that reaches here is
       normally complete. This catches the reporter who jumped straight to this
       URL, and names the step that owns the gap -- the photograph above is
       optional and is never the reason a submit is refused. */
    function missingStep() {
        if (!draft.incident_type || draft.description.trim() === '') return 1;
        if (draft.latitude === null || draft.longitude === null) return 2;
        return 0;
    }

    function handleFileChange(event) {
        const file = event.target.files?.[0];
        // Reset immediately so picking the same file twice still fires change,
        // which is what happens when someone retakes a photo they just removed.
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('That file is not an image. Choose a photo instead.');
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            const mb = (file.size / 1024 / 1024).toFixed(1);
            setError(`That photo is ${mb} MB. Please use one under 10 MB.`);
            return;
        }
        setError('');
        setPhoto(file);
    }

    async function handleSubmit() {
        if (submitting) return;

        if (!isLoggedIn()) {
            navigate('/login');
            return;
        }
        const missing = missingStep();
        if (missing) {
            setError(`Step ${missing} is incomplete. Go back and fill it in before submitting.`);
            return;
        }

        setError('');
        setSubmitting(true);
        try {
            const incident = await apiFetch('/incidents/', {
                method: 'POST',
                body: photo ? buildFormData(draft, photo) : JSON.stringify(draft),
            });
            resetDraft();
            // `replace` so Back returns to the wizard's step 2, not to a
            // finished report that can no longer be submitted again.
            navigate('/continue4', { state: { incident }, replace: true });
        } catch (err) {
            setError(err.message || 'Failed to submit report.');
            setSubmitting(false);
        }
    }

    return(
        <center>
            <CivHeader title="Step 3 of 3" subtitle="Photograph" />
            <p className="addphoto">Add Supporting Photograph (Optional)</p>
            <div className="photo-warning">
                <span className="photo-warning-icon">⚠️</span>
                <p>Do not approach the fire or place yourself in danger to capture a photograph.</p>
            </div>

            {/* Two inputs rather than one: `capture` asks the phone for the
                camera directly, and a gallery pick must not carry it. Both are
                hidden so the existing buttons stay the visible control. */}
            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                hidden
            />
            <input
                ref={galleryInput}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
            />

            {previewUrl ? (
                <div className="photo-preview">
                    <img src={previewUrl} alt="Attached photograph of the incident" />
                    <p className="photo-preview-name">
                        {photo.name} · {(photo.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <button
                        type="button"
                        className="photo-remove"
                        onClick={() => setPhoto(null)}
                        disabled={submitting}
                    >
                        REMOVE PHOTO
                    </button>
                </div>
            ) : (
                <>
                    <button
                        type="button"
                        className="takephoto"
                        onClick={() => cameraInput.current?.click()}
                        disabled={submitting}
                    >
                        TAKE SAFE PHOTO
                    </button>
                    <br />
                    <button
                        type="button"
                        className="selectphoto"
                        onClick={() => galleryInput.current?.click()}
                        disabled={submitting}
                    >
                        SELECT FROM GALLERY
                    </button>
                </>
            )}

            {error && (
                <p className="auth-error">
                    {error}
                    <br />
                    <small>The photograph is optional — this is not about the photo.</small>
                </p>
            )}

            <div className="backcontinue-container">
            <button className="backbtn" disabled={submitting}><Link to="/continue2">Back</Link></button>
            <button className="continuebtn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
            </div>
        </center>
    );
}

export default PhotoStep;
