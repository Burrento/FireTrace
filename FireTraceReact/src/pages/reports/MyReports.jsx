import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import '../../style.css';
import { API_BASE_URL } from '../../api';
import BottomNav from '../../components/BottomNav';
import ThemeToggle from '../../components/ThemeToggle';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'verified', label: 'Verified' },
    { key: 'responding', label: 'Responding' },
    { key: 'resolved', label: 'Resolved' },
];

function statusClass(status) {
    return `civ-status-badge status-${status.toLowerCase().replace(/_/g, '-')}`;
}

function statusLabel(status) {
    return status.replace(/_/g, ' ').toUpperCase();
}

function MyReports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

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
            .then((data) => setReports(Array.isArray(data) ? data : []))
            .catch(() => setError('Could not load your reports.'))
            .finally(() => setLoading(false));
    }, [navigate]);

    function handleLogout() {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        navigate('/login');
    }

    const visibleReports = useMemo(() => {
        const term = search.trim().toLowerCase();
        return reports.filter((report) => {
            if (filter !== 'all' && report.status !== filter) return false;
            if (!term) return true;
            return [report.reference_number, report.barangay, report.incident_type, report.address]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(term));
        });
    }, [reports, filter, search]);

    const counts = useMemo(() => {
        return reports.reduce((acc, report) => {
            acc[report.status] = (acc[report.status] || 0) + 1;
            return acc;
        }, {});
    }, [reports]);

    return (
        <div className="civilian-dashboard">
            {/* Header */}
            <header className="civ-header">
                <div className="civ-header-left">
                    <div className="civ-logo-container">
                        <i className="fa-solid fa-fire-flame-curved civ-logo-icon"></i>
                        <div className="civ-brand">
                            <span className="civ-brand-fire">FIRE</span>
                            <span className="civ-brand-trace">TRACE</span>
                        </div>
                    </div>
                </div>
                <div className="civ-header-right">
                    <ThemeToggle />
                    <button className="civ-icon-btn" onClick={handleLogout} title="Log out">
                        <i className="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </header>

            <div className="civ-main-content civ-page-content">
                {/* Page heading */}
                <section className="civ-page-head">
                    <h1 className="civ-page-title">My Reports</h1>
                    <p className="civ-page-subtitle">
                        {loading
                            ? 'Loading your reports...'
                            : `${reports.length} report${reports.length === 1 ? '' : 's'} submitted`}
                    </p>
                </section>

                {/* Search */}
                <section className="civ-search">
                    <i className="fa-solid fa-magnifying-glass civ-search-icon"></i>
                    <input
                        className="civ-search-input"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by reference, barangay, or type"
                    />
                    {search && (
                        <button className="civ-search-clear" onClick={() => setSearch('')} title="Clear search">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </section>

                {/* Status filters */}
                <section className="civ-filter-row">
                    {FILTERS.map((item) => {
                        const count = item.key === 'all' ? reports.length : counts[item.key] || 0;
                        return (
                            <button
                                key={item.key}
                                className={item.key === filter ? 'civ-filter-chip civ-filter-chip-active' : 'civ-filter-chip'}
                                onClick={() => setFilter(item.key)}
                            >
                                {item.label}
                                <span className="civ-filter-count">{count}</span>
                            </button>
                        );
                    })}
                </section>

                {/* Report list */}
                <section className="civ-report-section">
                    {loading ? (
                        <div className="civ-loading-state">
                            <div className="civ-skeleton-card"></div>
                            <div className="civ-skeleton-card"></div>
                            <div className="civ-skeleton-card"></div>
                        </div>
                    ) : error ? (
                        <div className="civ-error-state">
                            <p>{error}</p>
                            <button onClick={() => window.location.reload()} className="civ-retry-btn">
                                Retry
                            </button>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="civ-empty-state">
                            <div className="civ-empty-icon">
                                <i className="fa-solid fa-file-circle-plus"></i>
                            </div>
                            <h3>No reports yet</h3>
                            <p>You haven't submitted any reports.</p>
                            <p className="civ-empty-secondary">Once you do, they'll show up here.</p>
                            <Link to="/report" className="civ-empty-action">
                                Submit Your First Report
                            </Link>
                        </div>
                    ) : visibleReports.length === 0 ? (
                        <div className="civ-empty-state">
                            <div className="civ-empty-icon">
                                <i className="fa-solid fa-filter-circle-xmark"></i>
                            </div>
                            <h3>No matching reports</h3>
                            <p>Try a different status or search term.</p>
                            <button
                                className="civ-empty-action"
                                onClick={() => {
                                    setFilter('all');
                                    setSearch('');
                                }}
                            >
                                Clear Filters
                            </button>
                        </div>
                    ) : (
                        <div className="civ-reports-list">
                            {visibleReports.map((report) => (
                                <Link key={report.id} to={`/report/${report.id}`} className="civ-report-item">
                                    <div className="civ-report-header">
                                        <span className="civ-report-id">{report.reference_number}</span>
                                        <span className={statusClass(report.status)}>{statusLabel(report.status)}</span>
                                    </div>
                                    <div className="civ-report-details">
                                        <div className="civ-report-detail-row">
                                            <i className="fa-solid fa-house-fire"></i>
                                            <span>{report.incident_type}</span>
                                        </div>
                                        <div className="civ-report-detail-row">
                                            <i className="fa-solid fa-map-pin"></i>
                                            <span>Barangay {report.barangay}</span>
                                        </div>
                                        {report.created_at && (
                                            <div className="civ-report-detail-row">
                                                <i className="fa-solid fa-calendar"></i>
                                                <span>{new Date(report.created_at).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="civ-report-action">
                                        <span className="civ-report-view">View Details</span>
                                        <i className="fa-solid fa-arrow-right"></i>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <BottomNav />
        </div>
    );
}

export default MyReports;
