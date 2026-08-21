import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../style.css';
import { API_BASE_URL } from '../api';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const access = localStorage.getItem('access');
    if (!access) {
      navigate('/login');
      return;
    }

    // Fetch user data
    fetch(`${API_BASE_URL}/accounts/me`, {
      headers: { Authorization: 'Bearer ' + access },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        navigate('/login');
      });

    // Fetch reports
    fetch(`${API_BASE_URL}/incidents/`, {
      headers: { Authorization: 'Bearer ' + access },
    })
      .then((res) => {
        if (!res.ok) {
          setReportsError('Unable to load your latest reports');
          setReports([]);
        } else {
          return res.json().then((data) => {
            setReports(Array.isArray(data) ? data : []);
            setReportsError('');
          });
        }
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
          <div className="civ-notification-icon">
            <i className="fa-solid fa-bell"></i>
            <span className="civ-notification-badge"></span>
          </div>
          <button 
            className="civ-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <i className="fa-solid fa-bars"></i>
          </button>
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
                    <span className={`civ-status-badge status-${report.status.toLowerCase().replace(/_/g, '-')}`}>
                      {report.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="civ-report-details">
                    <div className="civ-report-detail-row">
                      <i className="fa-solid fa-home"></i>
                      <span>{report.incident_type}</span>
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
            <div className="civ-quick-card">
              <div className="civ-quick-icon">
                <i className="fa-solid fa-bell"></i>
              </div>
              <h4>Alerts & Updates</h4>
              <p>Stay informed in real-time</p>
            </div>
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
      <nav className="civ-bottom-nav">
        <Link className="civ-nav-item civ-nav-active" to="/dashboard">
          <i className="fa-solid fa-house"></i>
          <span>Home</span>
        </Link>
        <Link className="civ-nav-item" to="/report">
          <i className="fa-solid fa-pen"></i>
          <span>Report</span>
        </Link>
        <Link className="civ-nav-item" to="/myreport">
          <i className="fa-solid fa-file-lines"></i>
          <span>My Reports</span>
        </Link>
        <Link className="civ-nav-item" to="/dashboard">
          <i className="fa-solid fa-bell"></i>
          <span>Alerts</span>
        </Link>
        <Link className="civ-nav-item" to="/dashboard">
          <i className="fa-solid fa-circle-user"></i>
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}

export default Dashboard;
