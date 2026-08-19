import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../style.css';

const reports = [
    {
        id: 'FT-2026-00124',
        status: 'Under Review',
        type: 'Residential Fire',
        location: 'Barangay San Vicente North',
        date: 'May 20, 2026 · 08:35 AM',
    },
    {
        id: 'FT-2026-00110',
        status: 'Verified',
        type: 'Grass Fire',
        location: 'Brgy. San Roque',
        date: 'May 18, 2026 · 03:10 PM',
    },
    {
        id: 'FT-2026-00015',
        status: 'Resolved',
        type: 'Vehicle Fire',
        location: 'Brgy. San Vicente South',
        date: 'May 15, 2026 · 11:05 AM',
    },
];

function statusClass(status) {
    return 'status-badge status-' + status.toLowerCase().replace(/\s+/g, '-');
}

function MyReport() {
    const [expandedId, setExpandedId] = useState(reports[0]?.id ?? null);

    return(
        <center>
            <header className="top-bar">
                <h2 className="firetraceheader">MY REPORT</h2>
                <button className="LogOut"><Link to="/">Log Out</Link></button>
            </header>
            <div class="search-container">
                <input className="searchInput" type="text" placeholder="Search..."></input>
                <button type="button" className="searchbtn">🔍</button>
            </div>
            <div className="filter-buttons">
                <button class="filter-btn-active">All</button>
                <button class="filter-btn">Submitted</button>
                <button class="filter-btn">Under Review</button>
                <button class="filter-btn">Verified</button>
                <button class="filter-btn">Responding</button>
                <button class="filter-btn">Resolved</button>
            </div>
            <div className="report-list">
                {reports.map((report) => (
                    <div
                        key={report.id}
                        className="report-card"
                        onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                    >
                        <div className="report-card-header">
                            <span className="report-id">{report.id}</span>
                            <span className={statusClass(report.status)}>{report.status.toUpperCase()}</span>
                        </div>
                        <p className="report-subtitle">{report.type} · {report.location}</p>
                        <p className="report-date">{report.date}</p>
                        {expandedId === report.id && (
                            <Link to={`/report/${report.id}`} className="view-details-btn">
                                VIEW DETAILS
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </center>
    );
}

export default MyReport;