import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { apiFetch } from '../api';
import { clearTokens, isLoggedIn } from '../auth';
import { humanize } from '../lib/incidentDisplay';
import BottomNav from '../components/BottomNav';
import ThemeToggle from '../components/ThemeToggle';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }

    // Fetch user data
    apiFetch('/accounts/me')
      .then((profile) => {
        // A remembered BFP session lands here first; send it to the portal.
        if (profile.user_type === 'bfp') {
          navigate('/bfp', { replace: true });
          return;
        }
        setUser(profile);
      })
      .catch(() => {
        clearTokens();
        navigate('/login');
      });

    // Fetch reports
    apiFetch('/incidents/')
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
        setReportsError('');
      })
      .catch(() => {
        setReportsError('Unable to load your latest reports');
        setReports([]);
      })
      .finally(() => setReportsLoading(false));
  }, [navigate]);

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="dashboard-text">Loading your dashboard...</p>
      </div>
    );
  }

  const latestReports = reports.slice(0, 3);
  const userDisplayName = user.first_name ? user.first_name.split(' ')[0] : user.username;

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
          <Link to="/Notifications" className="civ-notification-icon">
            <i className="fa-solid fa-bell"></i>
            <span className="civ-notification-badge"></span>
          </Link>
          <Link to="/profile" className="civ-menu-btn">
            <i className="fa-solid fa-bars"></i>
          </Link>
        </div>
      </header>

      {/* Welcome Card */}
      <section className="civ-welcome-section">
        <div className="civ-welcome-card">
          <div className="civ-welcome-top">
            <div className="civ-avatar">
              {user.email ? user.email.charAt(0).toUpperCase() : userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="civ-welcome-text">
              <h1 className="civ-greeting">GOOD DAY,<br/>{user.email}</h1>
              <div className="civ-verified-badge">
                <i className="fa-solid fa-shield-halved"></i>
                <span>VERIFIED CIVILIAN</span>
              </div>
            </div>
          </div>
          <div className="civ-welcome-accent"></div>
        </div>
      </section>

      {/* Safety Message */}
      <section className="civ-safety-message">
        <div className="civ-safety-icon">
          <i className="fa-solid fa-shield-exclamation"></i>
        </div>
        <div className="civ-safety-content">
          <h2>YOUR SAFETY MATTERS</h2>
          <p>In case of emergency, help is just a report away.</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="civ-main-content">
        {/* Safety Actions Section */}
        <section className="civ-safety-actions">
          <h2 className="civ-section-title">Safety Actions</h2>
          
          {/* Submit Report Card */}
          <Link to="/report" className="civ-action-card civ-action-primary">
            <div className="civ-action-icon">
              <i className="fa-solid fa-fire"></i>
            </div>
            <div className="civ-action-content">
              <div className="civ-action-main">
                <h3>Submit Fire Report</h3>
                <p>Report an active fire incident</p>
              </div>
              <div className="civ-action-badge">QUICK & SECURE</div>
            </div>
            <i className="fa-solid fa-chevron-right civ-action-arrow"></i>
          </Link>

          {/* Live Fire Map Card */}
          <Link to="/livemap" className="civ-action-card civ-action-live">
            <div className="civ-action-icon">
              <i className="fa-solid fa-map-location-dot"></i>
            </div>
            <div className="civ-action-content">
              <div className="civ-action-main">
                <h3>Live Fire Map</h3>
                <p>See fires burning near you right now</p>
              </div>
              <div className="civ-action-badge civ-action-badge-live">BFP VERIFIED</div>
            </div>
            <i className="fa-solid fa-chevron-right civ-action-arrow"></i>
          </Link>

          {/* Call BFP Card */}
          <a href="tel:+639171234567" className="civ-action-card civ-action-secondary">
            <div className="civ-action-icon">
              <i className="fa-solid fa-phone"></i>
            </div>
            <div className="civ-action-content">
              <div className="civ-action-main">
                <h3>Call BFP Calapan</h3>
                <p>Emergency hotline</p>
              </div>
              <div className="civ-action-badge civ-action-badge-secondary">24/7 AVAILABLE</div>
            </div>
            <i className="fa-solid fa-chevron-right civ-action-arrow"></i>
          </a>
        </section>

        {/* Latest Reports Section */}
        <section className="civ-latest-reports">
          <div className="civ-section-header">
            <h2 className="civ-section-title">Latest Reports</h2>
            {reports.length > 0 && (
              <Link to="/myreport" className="civ-view-all-link">View all</Link>
            )}
          </div>

          {reportsLoading ? (
            <div className="civ-loading-state">
              <div className="civ-skeleton-card"></div>
              <div className="civ-skeleton-card"></div>
            </div>
          ) : reportsError ? (
            <div className="civ-error-state">
              <p>{reportsError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="civ-retry-btn"
              >
                Retry
              </button>
            </div>
          ) : latestReports.length === 0 ? (
            <div className="civ-empty-state">
              <div className="civ-empty-icon">
                <i className="fa-solid fa-file-circle-plus"></i>
              </div>
              <h3>No reports yet</h3>
              <p>You haven't submitted any reports.</p>
              <p className="civ-empty-secondary">Once you do, your latest reports will appear here.</p>
              <Link to="/report" className="civ-empty-action">
                Submit Your First Report
              </Link>
            </div>
          ) : (
            <div className="civ-reports-list">
              {latestReports.map((report) => (
                <Link 
                  key={report.id} 
                  to={`/report/${report.id}`} 
                  className="civ-report-item"
                >
                  <div className="civ-report-header">
                    <span className="civ-report-id">{report.reference_number}</span>
                    <span className={`civ-status-badge status-${String(report.status).toLowerCase().replace(/_/g, '-')}`}>
                      {humanize(report.status_display, report.status).toUpperCase()}
                    </span>
                  </div>
                  <div className="civ-report-details">
                    <div className="civ-report-detail-row">
                      <i className="fa-solid fa-home"></i>
                      <span>{humanize(report.incident_type_display, report.incident_type)}</span>
                    </div>
                    <div className="civ-report-detail-row">
                      <i className="fa-solid fa-map-pin"></i>
                      <span>{report.barangay}</span>
                    </div>
                    {report.created_at && (
                      <div className="civ-report-detail-row">
                        <i className="fa-solid fa-calendar"></i>
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
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

        {/* Quick Access Section */}
        <section className="civ-quick-access">
          <h2 className="civ-section-title">Quick Access</h2>
          <div className="civ-quick-grid">
            <div className="civ-quick-card">
              <div className="civ-quick-icon">
                <i className="fa-solid fa-shield"></i>
              </div>
              <h4>Safety Tips</h4>
              <p>Learn how to stay safe</p>
            </div>
            <div className="civ-quick-card">
              <div className="civ-quick-icon">
                <i className="fa-solid fa-location-dot"></i>
              </div>
              <h4>Evacuation Centers</h4>
              <p>Find nearest safe locations</p>
            </div>
            <Link to="/livemap" className="civ-quick-card">
              <div className="civ-quick-icon">
                <i className="fa-solid fa-fire"></i>
              </div>
              <h4>Ongoing Fires</h4>
              <p>Live map of active fires</p>
            </Link>
            <Link to="/myreport" className="civ-quick-card">
              <div className="civ-quick-icon">
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <h4>My Reports</h4>
              <p>View your submitted reports</p>
            </Link>
          </div>
        </section>

        {/* Preparedness Card */}
        <section className="civ-preparedness">
          <div className="civ-prep-content">
            <h2>BE PREPARED, STAY SAFE</h2>
            <p>Fire can spread fast. Your quick action can save lives.</p>
            <button className="civ-prep-btn">
              LEARN MORE <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
          <div className="civ-prep-visual">
            <i className="fa-solid fa-house-fire"></i>
          </div>
        </section>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default Dashboard;
