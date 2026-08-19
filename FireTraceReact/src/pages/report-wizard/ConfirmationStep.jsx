import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import '../../style.css';
import { authFetchJson, getAccessToken } from '../../api';
import { useReportDraft } from '../../context/useReportDraft';

function ConfirmationStep() {
    const navigate = useNavigate();
    const { draft, resetDraft } = useReportDraft();
    const [incident, setIncident] = useState(null);
    const [error, setError] = useState('');
    const submitted = useRef(false);

    useEffect(() => {
        if (submitted.current) return;
        submitted.current = true;

        if (!getAccessToken()) {
            navigate('/login');
            return;
        }

        authFetchJson('/incidents/', {
            method: 'POST',
            body: JSON.stringify(draft),
        })
            .then((data) => {
                setIncident(data);
                resetDraft();
            })
            .catch((err) => setError(err.message || 'Failed to submit report.'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Fire Report Incident</h2>
                <p>4 of 4</p>
            </header>

            {error && <p className="submitted-subtitle">{error}</p>}

            {incident && (
                <>
                    <div className="submitted-icon">&#10003;</div>
                    <h2 className="submitted-title">REPORT SUBMITTED</h2>
                    <p className="submitted-subtitle">Your report was successfully recorded and forwarded for BFP review.</p>

                    <div className="incident-card submitted-card">
                        <p className="submitted-label">Reference Number</p>
                        <p className="submitted-reference">{incident.reference_number}</p>

                        <p className="submitted-label">Submitted</p>
                        <p className="submitted-value">{new Date(incident.created_at).toLocaleString()}</p>

                        <p className="submitted-label">Current Status</p>
                        <span className="submitted-status">{incident.status.toUpperCase()}</span>
                    </div>
                </>
            )}

            {!incident && !error && <p className="submitted-subtitle">Submitting your report…</p>}

            <button className="view-status-button"><Link to="/myreport">VIEW REPORT STATUS</Link></button><br />
            <button className="contact-bfp-button">&#128222; CONTACT BFP FOR URGENT HELP</button>
        </div>
    );
}

export default ConfirmationStep;
