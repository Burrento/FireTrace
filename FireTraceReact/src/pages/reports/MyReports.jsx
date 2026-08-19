import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { authFetch, getAccessToken, logout } from '../../api';
import { statusClass, humanize } from '../../lib/incidentDisplay';

function MyReports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!getAccessToken()) {
            navigate('/login');
            return;
        }
        authFetch('/incidents/')
            .then((res) => {
                if (!res.ok) throw new Error('Session expired');
                return res.json();
            })
            .then((data) => {
                setReports(data);
                setExpandedId(data[0]?.id ?? null);
            })
            .catch(() => setError('Could not load your reports.'));
    }, [navigate]);

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    return(
        <div className="page">
            <header className="top-bar">
                <h2 className="firetraceheader">FIRETRACE</h2>
                <button className="LogOut" onClick={handleLogout}>Log Out</button>
            </header>
            <div className="search-container">
                <input className="searchInput" type="text" placeholder="Search..."></input>
                <button type="button" className="searchbtn">🔍</button>
            </div>
            <div className="filter-buttons">
                <button className="filter-btn-active">All</button>
                <button className="filter-btn">Submitted</button>
                <button className="filter-btn">Under Review</button>
                <button className="filter-btn">Verified</button>
                <button className="filter-btn">Responding</button>
                <button className="filter-btn">Resolved</button>
            </div>
            {error && <p className="report-subtitle">{error}</p>}
            {!error && reports.length === 0 && <p className="report-subtitle">You haven't submitted any reports yet.</p>}
            <div className="report-list">
                {reports.map((report) => (
                    <div
                        key={report.id}
                        className="report-card"
                        onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                    >
                        <div className="report-card-header">
                            <span className="report-id">{report.reference_number}</span>
                            <span className={statusClass(report.status)}>
                                {humanize(report.status_display, report.status).toUpperCase()}
                            </span>
                        </div>
                        <p className="report-subtitle">
                            {humanize(report.incident_type_display, report.incident_type)} · Barangay {report.barangay}
                        </p>
                        <p className="report-date">{new Date(report.created_at).toLocaleString()}</p>
                        {expandedId === report.id && (
                            <Link to={`/report/${report.id}`} className="view-details-btn">
                                VIEW DETAILS
                            </Link>
                        )}
                    </div>
                ))}
            </div>
            <nav className="bottom-nav">
            <button className="bottom-btn"><Link to="/dashboard">Home</Link></button>
            <button className="bottom-btn"><Link to="/report">Report</Link></button>
            <button className="bottom-btn-active"><Link to="/myreport">My Report</Link></button>
            <button className="bottom-btn"><Link to="/">Notifications</Link></button>
            <button className="bottom-btn"><Link to="/">Profile</Link></button>
        </nav>
        </div>
    );
}

export default MyReports;
