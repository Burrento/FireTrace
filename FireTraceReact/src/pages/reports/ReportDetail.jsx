import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../../style.css';
import { apiFetch } from '../../api';
import { isLoggedIn } from '../../auth';
import IncidentMap from '../../components/IncidentMap';
import BottomNav from '../../components/BottomNav';
import ThemeToggle from '../../components/ThemeToggle';
import { humanize } from '../../lib/incidentDisplay';

/* Mirrors Incident.Status in the backend, in order, so the tracker can show
   how far along a report is. */
const TIMELINE = [
    { key: 'submitted', label: 'Submitted', icon: 'fa-paper-plane' },
    { key: 'under_review', label: 'Under Review', icon: 'fa-magnifying-glass' },
    { key: 'verified', label: 'Verified', icon: 'fa-circle-check' },
    { key: 'responding', label: 'Responding', icon: 'fa-truck-fast' },
    { key: 'resolved', label: 'Resolved', icon: 'fa-flag-checkered' },
];

function ReportDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [incident, setIncident] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isLoggedIn()) {
            navigate('/login');
            return;
        }
        apiFetch(`/incidents/${id}/`)
            .then(setIncident)
            .catch(() => setError('Report not found'));
    }, [id, navigate]);

    const header = (
        <header className="civ-header">
            <div className="civ-header-left">
                <button className="civ-back-btn" onClick={() => navigate('/myreport')} title="Back to my reports">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="civ-brand">
                    <span className="civ-brand-fire">REPORT</span>
                    <span className="civ-brand-trace">DETAILS</span>
                </div>
            </div>
            <div className="civ-header-right">
                <ThemeToggle />
            </div>
        </header>
    );

    if (error) {
        return (
            <div className="civilian-dashboard">
                {header}
                <div className="civ-main-content civ-page-content">
                    <div className="civ-error-state">
                        <p>{error}</p>
                        <button className="civ-retry-btn" onClick={() => navigate('/myreport')}>
                            Back to My Reports
                        </button>
                    </div>
                </div>
                <BottomNav />
            </div>
        );
    }

    if (!incident) {
        return (
            <div className="civilian-dashboard">
                {header}
                <div className="civ-main-content civ-page-content">
                    <div className="civ-loading-state">
                        <div className="civ-skeleton-card"></div>
                        <div className="civ-skeleton-card"></div>
                    </div>
                </div>
                <BottomNav />
            </div>
        );
    }

    const currentStep = TIMELINE.findIndex((step) => step.key === incident.status);

    return (
        <div className="civilian-dashboard">
            {header}

            <div className="civ-main-content civ-page-content">
                {/* Summary */}
                <section className="civ-detail-card">
                    <div className="civ-report-header">
                        <span className="civ-report-id">{incident.reference_number}</span>
                        <span className={`civ-status-badge status-${String(incident.status).toLowerCase().replace(/_/g, '-')}`}>
                            {humanize(incident.status_display, incident.status).toUpperCase()}
                        </span>
                    </div>
                    <h1 className="civ-detail-title">{humanize(incident.incident_type_display, incident.incident_type)}</h1>
                    <p className="civ-detail-location">
                        <i className="fa-solid fa-location-dot"></i>
                        Barangay {incident.barangay}
                    </p>
                </section>

                {/* Progress tracker */}
                <section>
                    <h2 className="civ-section-title">Report Status</h2>
                    <div className="civ-timeline">
                        {TIMELINE.map((step, index) => {
                            const state =
                                index < currentStep ? 'done' : index === currentStep ? 'current' : 'upcoming';
                            return (
                                <div key={step.key} className={`civ-timeline-step civ-timeline-${state}`}>
                                    <div className="civ-timeline-marker">
                                        <i className={`fa-solid ${step.icon}`}></i>
                                    </div>
                                    <span className="civ-timeline-label">{step.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Details */}
                <section>
                    <h2 className="civ-section-title">Incident Details</h2>
                    <div className="civ-detail-grid">
                        <div className="civ-detail-row">
                            <i className="fa-solid fa-house-fire"></i>
                            <div>
                                <span className="civ-detail-label">Type</span>
                                <span className="civ-detail-value">{humanize(incident.incident_type_display, incident.incident_type)}</span>
                            </div>
                        </div>
                        <div className="civ-detail-row">
                            <i className="fa-solid fa-location-dot"></i>
                            <div>
                                <span className="civ-detail-label">Barangay</span>
                                <span className="civ-detail-value">{incident.barangay}</span>
                            </div>
                        </div>
                        {incident.address && (
                            <div className="civ-detail-row">
                                <i className="fa-solid fa-map-pin"></i>
                                <div>
                                    <span className="civ-detail-label">Address</span>
                                    <span className="civ-detail-value">{incident.address}</span>
                                </div>
                            </div>
                        )}
                        <div className="civ-detail-row">
                            <i className="fa-solid fa-clock"></i>
                            <div>
                                <span className="civ-detail-label">Reported</span>
                                <span className="civ-detail-value">
                                    {new Date(incident.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        {incident.description && (
                            <div className="civ-detail-row">
                                <i className="fa-solid fa-align-left"></i>
                                <div>
                                    <span className="civ-detail-label">Description</span>
                                    <span className="civ-detail-value">{incident.description}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Location */}
                <section>
                    <h2 className="civ-section-title">Location</h2>
                    <div className="civ-detail-map">
                        <IncidentMap
                            latitude={Number(incident.latitude)}
                            longitude={Number(incident.longitude)}
                        />
                    </div>
                </section>
            </div>

            <BottomNav />
        </div>
    );
}

export default ReportDetail;
