import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { API_BASE_URL } from '../../api';

function statusClass(status) {
    return 'status-badge status-' + status.toLowerCase().replace(/\s+/g, '-');
}

function MyReports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const access = localStorage.getItem('access');
        if (!access) {
            navigate('/login');
            return;
        }
        fetch(`${API_BASE_URL}/incidents/`, {
            headers: { Authorization: 'Bearer ' + access },
        })
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

    function handleLogout() {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        navigate('/login');
    }

    return(
        <center>
            <header className="top-bar">
                <div className="brand-identity">
                    <div className="app-logo">
                        <i className="fa-solid fa-fire-flame-simple"></i>
                        <div className="logo-glow"/>
                    </div>
                    <div className="app-name">
                        <span className="fire-txt">FIRE</span>
                        <span className="trace-txt">TRACE</span>
                    </div>
                </div>
                <button className="LogOut" onClick={handleLogout}>
                    <i className="fa-solid fa-right-from-bracket"></i> Log Out
                </button>
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
                            <span className={statusClass(report.status)}>{report.status.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <p className="report-subtitle">{report.incident_type} · Barangay {report.barangay}</p>
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

export default MyReports;
