import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';
import { isLoggedIn } from '../../auth';
import { useReportDraft } from '../../context/useReportDraft';
import BottomNav from '../../components/BottomNav';

/* Step 3 of 3 — the last step, and the one that actually files the report.

   Submitting from a button press rather than on arrival at a confirmation
   screen means the POST happens exactly once, on a deliberate action: a
   refresh or a back-then-forward can no longer file a second copy of the same
   fire, which the duplicate rule would then have to flag. */
function PhotoStep() {
    const navigate = useNavigate();
    const { draft, resetDraft } = useReportDraft();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    /* Each step gates its own Continue, so a draft that reaches here is
       normally complete. This catches the reporter who jumped straight to this
       URL, and names the step that owns the gap -- the photograph above is
       optional and is never the reason a submit is refused. */
    function missingStep() {
        if (!draft.incident_type || draft.description.trim() === '') return 1;
        if (draft.latitude === null || draft.longitude === null) return 2;
        return 0;
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
                body: JSON.stringify(draft),
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
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>3 of 3</p>
            </header>
            <p className="addphoto">Add Supporting Photograph (Optional)</p>
            <div className="photo-warning">
                <span className="photo-warning-icon">⚠️</span>
                <p>Do not approach the fire or place yourself in danger to capture a photograph.</p>
            </div>
            <button className = "takephoto">TAKE SAFE PHOTO</button><br />
            <button className = "selectphoto">SELECT FROM GALLERY</button>

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
            <BottomNav active="report" />
        </center>
    );
}

export default PhotoStep;
