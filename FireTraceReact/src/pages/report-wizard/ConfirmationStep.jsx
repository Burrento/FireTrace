import { Link, Navigate, useLocation } from 'react-router-dom';
import '../../style.css';
import CivHeader from '../../components/CivHeader';

/* The receipt, not a wizard step — step 3 files the report and hands the
   created record over in router state.

   Nothing is submitted here any more. Reaching this URL without that state
   means a refresh or a typed address rather than a submission, so send the
   reporter to their reports list instead of filing anything. */
function ConfirmationStep() {
    const { state } = useLocation();
    const incident = state?.incident;

    if (!incident) return <Navigate to="/myreport" replace />;

    return(
        <center>
            <CivHeader title="Report filed" subtitle="Reference and status" />

            <div className="submitted-icon">&#10003;</div>
            <h2 className="submitted-title">REPORT SUBMITTED</h2>
            <p className="submitted-subtitle">Your report was successfully recorded and forwarded for BFP review.</p>

            <div className="incident-card submitted-card">
                <p className="submitted-label">Reference Number</p>
                <p className="submitted-reference">{incident.reference_number}</p>

                <p className="submitted-label">Submitted</p>
                <p className="submitted-value">{new Date(incident.created_at).toLocaleString()}</p>

                <p className="submitted-label">Current Status</p>
                <span className="submitted-status">{String(incident.status_display || incident.status).toUpperCase()}</span>
            </div>

            <button className="view-status-button"><Link to="/myreport">VIEW REPORT STATUS</Link></button><br />
            <button className="contact-bfp-button">&#128222; CONTACT BFP FOR URGENT HELP</button>
        </center>
    );
}

export default ConfirmationStep;
