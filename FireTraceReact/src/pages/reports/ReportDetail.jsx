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
                <button className="back-btn" onClick={() => navigate('/myreport')}>
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="brand-identity">
                    <div className="app-name">
                        <span className="fire-txt">REPORT</span>
                        <span className="trace-txt">DETAILS</span>
                    </div>
                </div>
                <div style={{width: 48}}></div>
            </header>

            <div className="incident-card">
                <div className="incident-header">
                    <span className="reference-number">{incident.reference_number}</span>
                    <span className={`status-badge status-${incident.status.toLowerCase().replace(/_/g, '-')}`}>
                        {incident.status.replace('_', ' ').toUpperCase()}
                    </span>
                </div>

                <div className="incident-info">
                    <div className="info-item">
                        <i className="fa-solid fa-house-fire"></i>
                        <span>{incident.incident_type}</span>
                    </div>
                    <div className="info-item">
                        <i className="fa-solid fa-location-dot"></i>
                        <span>Barangay {incident.barangay}</span>
                    </div>
                    {incident.address && (
                        <div className="info-item">
                            <i className="fa-solid fa-map-pin"></i>
                            <span>{incident.address}</span>
                        </div>
                    )}
                    <div className="info-item">
                        <i className="fa-solid fa-clock"></i>
                        <span>{new Date(incident.created_at).toLocaleString()}</span>
                    </div>
                    {incident.description && (
                        <div className="info-item">
                            <i className="fa-solid fa-align-left"></i>
                            <span>{incident.description}</span>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ width: '90%', margin: '12px 0' }}>
                <IncidentMap latitude={Number(incident.latitude)} longitude={Number(incident.longitude)} />
            </div>

            <nav className="bottom-nav">
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-house"></i>
                    <span>Home</span>
                </Link>
                <Link className="bottom-btn" to="/report">
                    <i className="fa-solid fa-bullhorn"></i>
                    <span>Report</span>
                </Link>
                <Link className="bottom-btn-active" to="/myreport">
                    <i className="fa-solid fa-list-check"></i>
                    <span>My Reports</span>
                </Link>
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-bell"></i>
                    <span>Alerts</span>
                </Link>
                <Link className="bottom-btn" to="/dashboard">
                    <i className="fa-solid fa-user-gear"></i>
                    <span>Profile</span>
                </Link>
            </nav>
        </center>
    );
}

export default ReportDetail;
