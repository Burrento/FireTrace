import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { API_BASE_URL } from '../../api';
import IncidentMap from '../../components/IncidentMap';
import { statusClass, humanize } from '../../lib/incidentDisplay';

function ReportDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [incident, setIncident] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const access = localStorage.getItem('access');
        if (!access) {
            navigate('/login');
            return;
        }
        fetch(`${API_BASE_URL}/incidents/${id}/`, {
            headers: { Authorization: `Bearer ${access}` },
        })
            .then((res) => {
                if (!res.ok) throw new Error('Report not found');
                return res.json();
            })
            .then(setIncident)
            .catch((err) => setError(err.message));
    }, [id, navigate]);

    if (error) {
        return <div className="page"><p className="submitted-subtitle">{error}</p></div>;
    }

    if (!incident) {
        return <div className="page"><p className="submitted-subtitle">Loading…</p></div>;
    }

    return (
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">Report Details</h2>
            </header>

            <div className="incident-card">
                <div className="incident-header">
                    <span className="reference-number">{incident.reference_number}</span>
                    <span className={statusClass(incident.status)}>
                        {humanize(incident.status_display, incident.status).toUpperCase()}
                    </span>
                </div>

                <div className="incident-info">
                    <div>{humanize(incident.incident_type_display, incident.incident_type)}</div>
                    <div>Barangay {incident.barangay}</div>
                    {incident.address && <div>{incident.address}</div>}
                    <div>{new Date(incident.created_at).toLocaleString()}</div>
                    {incident.description && <div>{incident.description}</div>}
                </div>
            </div>

            <IncidentMap latitude={Number(incident.latitude)} longitude={Number(incident.longitude)} />

            <nav className="bottom-nav">
                <Link className="bottom-btn" to="/dashboard">Home</Link>
                <Link className="bottom-btn" to="/report">Report</Link>
                <Link className="bottom-btn-active" to="/myreport">My Report</Link>
                <Link className="bottom-btn" to="/">Notifications</Link>
                <Link className="bottom-btn" to="/">Profile</Link>
            </nav>
        </div>
    );
}

export default ReportDetail;
