import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { API_BASE_URL } from '../../api';
import IncidentMap from '../../components/IncidentMap';

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
            headers: { Authorization: 'Bearer ' + access },
        })
            .then((res) => {
                if (!res.ok) throw new Error('Report not found');
                return res.json();
            })
            .then(setIncident)
            .catch((err) => setError(err.message));
    }, [id, navigate]);

    if (error) {
        return <center><p className="submitted-subtitle">{error}</p></center>;
    }

    if (!incident) {
        return <center><p className="submitted-subtitle">Loading...</p></center>;
    }

    return (
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">Report Details</h2>
            </header>

            <div className="incident-card">
                <div className="incident-header">
                    <span className="reference-number">{incident.reference_number}</span>
                    <span className="status">{incident.status.replace('_', ' ').toUpperCase()}</span>
                </div>

                <div className="incident-info">
                    <div>{incident.incident_type}</div>
                    <div>Barangay {incident.barangay}</div>
                    {incident.address && <div>{incident.address}</div>}
                    <div>{new Date(incident.created_at).toLocaleString()}</div>
                    {incident.description && <div>{incident.description}</div>}
                </div>
            </div>

            <div style={{ width: '90%', margin: '12px 0' }}>
                <IncidentMap latitude={Number(incident.latitude)} longitude={Number(incident.longitude)} />
            </div>

            <nav className="bottom-nav">
                <Link className="bottom-btn" to="/dashboard">Home</Link>
                <Link className="bottom-btn" to="/report">Report</Link>
                <Link className="bottom-btn-active" to="/myreport">My Report</Link>
                <Link className="bottom-btn" to="/">Notifications</Link>
                <Link className="bottom-btn" to="/">Account</Link>
            </nav>
        </center>
    );
}

export default ReportDetail;
